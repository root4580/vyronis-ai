import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateMarketBias } from "@/lib/strategy-brain/market-bias-engine"
import { evaluateStrategySetup } from "@/lib/strategy-brain/orchestrator"
import { getWeekStartSunday } from "@/lib/strategy-brain/week-utils"
import type {
  BiasDirection,
  EmotionCheckAnswers,
  MarketBiasInput,
  MarketBiasRecord,
  PairPlanInput,
  PairPlanRecord,
  PostTradeReviewAnswers,
  StrategyBrainDashboard,
  StrategySetupEvaluationInput,
  StrategySetupEvaluationResult,
  TradeMemoryTrade,
  WeeklyPlanRecord,
  WeeklyPlanWithPairs,
} from "@/lib/strategy-brain/types"

export class StrategyBrainTableMissingError extends Error {
  constructor() {
    super("Run supabase/026-strategy-brain-foundation.sql to enable Strategy Brain.")
    this.name = "StrategyBrainTableMissingError"
  }
}

function throwIfMissing(error: { message?: string; code?: string } | null) {
  if (!error) return
  if (error.code === "42P01" || error.message?.includes("strategy_brain")) {
    throw new StrategyBrainTableMissingError()
  }
}

function normalizeBias(v: unknown): BiasDirection {
  if (v === "Bullish" || v === "Bearish" || v === "Neutral") return v
  return "Neutral"
}

export async function getMarketBias(
  supabase: SupabaseClient,
  userId: string,
): Promise<MarketBiasRecord | null> {
  const { data, error } = await supabase
    .from("strategy_brain_market_bias")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  throwIfMissing(error)
  if (error) throw new Error(error.message)
  if (!data) return null
  return data as MarketBiasRecord
}

export async function upsertMarketBias(
  supabase: SupabaseClient,
  userId: string,
  input: MarketBiasInput,
): Promise<MarketBiasRecord> {
  const evaluated = evaluateMarketBias(input)
  const row = {
    user_id: userId,
    weekly_bias: input.weekly_bias,
    daily_bias: input.daily_bias,
    h4_bias: input.h4_bias,
    directional_permission: evaluated.directional_permission,
    setup_valid: evaluated.setup_valid,
    conflict_summary: evaluated.conflict_summary,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("strategy_brain_market_bias")
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .single()

  throwIfMissing(error)
  if (error) throw new Error(error.message)
  return data as MarketBiasRecord
}

export async function getOrCreateWeeklyPlan(
  supabase: SupabaseClient,
  userId: string,
  weekStart?: string,
): Promise<WeeklyPlanRecord> {
  const week = weekStart ?? getWeekStartSunday()

  const { data: existing, error: fetchErr } = await supabase
    .from("strategy_brain_weekly_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", week)
    .maybeSingle()

  throwIfMissing(fetchErr)
  if (fetchErr) throw new Error(fetchErr.message)
  if (existing) return existing as WeeklyPlanRecord

  const { data, error } = await supabase
    .from("strategy_brain_weekly_plans")
    .insert({ user_id: userId, week_start: week })
    .select("*")
    .single()

  throwIfMissing(error)
  if (error) throw new Error(error.message)
  return data as WeeklyPlanRecord
}

export async function updateWeeklyPlanNotes(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
  session_notes: string,
): Promise<WeeklyPlanRecord> {
  const { data, error } = await supabase
    .from("strategy_brain_weekly_plans")
    .update({ session_notes, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("user_id", userId)
    .select("*")
    .single()

  throwIfMissing(error)
  if (error) throw new Error(error.message)
  return data as WeeklyPlanRecord
}

export async function listPairPlans(
  supabase: SupabaseClient,
  planId: string,
): Promise<PairPlanRecord[]> {
  const { data, error } = await supabase
    .from("strategy_brain_pair_plans")
    .select("*")
    .eq("plan_id", planId)
    .order("sort_order", { ascending: true })

  throwIfMissing(error)
  if (error) throw new Error(error.message)
  return (data || []) as PairPlanRecord[]
}

export async function getWeeklyPlanWithPairs(
  supabase: SupabaseClient,
  userId: string,
  weekStart?: string,
): Promise<WeeklyPlanWithPairs | null> {
  const week = weekStart ?? getWeekStartSunday()
  const { data: plan, error } = await supabase
    .from("strategy_brain_weekly_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", week)
    .maybeSingle()

  throwIfMissing(error)
  if (error) throw new Error(error.message)
  if (!plan) return null

  const pairs = await listPairPlans(supabase, plan.id)
  return { ...(plan as WeeklyPlanRecord), pairs }
}

export async function saveWeeklyPairPlans(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
  pairs: PairPlanInput[],
): Promise<PairPlanRecord[]> {
  if (pairs.length > 5) {
    throw new Error("Maximum 5 pairs per weekly plan.")
  }

  const { error: delErr } = await supabase
    .from("strategy_brain_pair_plans")
    .delete()
    .eq("plan_id", planId)
    .eq("user_id", userId)

  throwIfMissing(delErr)
  if (delErr) throw new Error(delErr.message)

  if (pairs.length === 0) return []

  const rows = pairs.map((p, i) => ({
    user_id: userId,
    plan_id: planId,
    pair: p.pair.trim().toUpperCase(),
    directional_bias: p.directional_bias ?? "Neutral",
    aoi_high: p.aoi_high ?? null,
    aoi_low: p.aoi_low ?? null,
    invalidation: p.invalidation ?? null,
    weekly_thesis: p.weekly_thesis ?? "",
    notes: p.notes ?? "",
    aoi_status: p.aoi_status ?? "WAITING",
    sort_order: p.sort_order ?? i,
  }))

  const { data, error } = await supabase
    .from("strategy_brain_pair_plans")
    .insert(rows)
    .select("*")

  throwIfMissing(error)
  if (error) throw new Error(error.message)
  return (data || []) as PairPlanRecord[]
}

export async function updatePairPlanStatus(
  supabase: SupabaseClient,
  userId: string,
  pairPlanId: string,
  aoi_status: PairPlanRecord["aoi_status"],
): Promise<PairPlanRecord> {
  const { data, error } = await supabase
    .from("strategy_brain_pair_plans")
    .update({ aoi_status, updated_at: new Date().toISOString() })
    .eq("id", pairPlanId)
    .eq("user_id", userId)
    .select("*")
    .single()

  throwIfMissing(error)
  if (error) throw new Error(error.message)
  return data as PairPlanRecord
}

async function fetchTradeMemory(
  supabase: SupabaseClient,
  userId: string,
  pair?: string,
): Promise<TradeMemoryTrade[]> {
  let q = supabase
    .from("trades")
    .select(
      "id, pair, direction, result, pnl, emotion, setup, confirmation_signal, mistake_tags, trade_date",
    )
    .eq("user_id", userId)
    .order("trade_date", { ascending: false })
    .limit(80)

  if (pair) {
    q = q.ilike("pair", pair.replace(/\s/g, ""))
  }

  const { data, error } = await q
  if (error) return []
  return (data || []) as TradeMemoryTrade[]
}

export async function runSetupEvaluation(
  supabase: SupabaseClient,
  userId: string,
  input: StrategySetupEvaluationInput,
): Promise<StrategySetupEvaluationResult> {
  const storedBias = await getMarketBias(supabase, userId)
  const marketInput: MarketBiasInput | null = storedBias
    ? {
        weekly_bias: normalizeBias(storedBias.weekly_bias),
        daily_bias: normalizeBias(storedBias.daily_bias),
        h4_bias: normalizeBias(storedBias.h4_bias),
      }
    : input.market_bias ?? null

  const historicalTrades = await fetchTradeMemory(supabase, userId, input.pair)
  const result = evaluateStrategySetup(input, {
    storedBias: marketInput,
    historicalTrades,
  })

  if (input.save_snapshot) {
    const { data, error } = await supabase
      .from("strategy_brain_setup_evaluations")
      .insert({
        user_id: userId,
        pair_plan_id: input.pair_plan_id ?? null,
        pair: input.pair,
        trade_direction: input.trade_direction ?? null,
        confirmation: input.confirmation,
        scoring: result.scoring,
        total_score: result.scoring.totalScore,
        grade: result.scoring.grade,
        recommendation: result.scoring.recommendation,
        borderline_count: result.scoring.borderlineCount,
        memory_insight: result.memoryInsight,
      })
      .select("id")
      .single()

    throwIfMissing(error)
    if (!error && data) {
      result.evaluationId = data.id as string
    }
  }

  return result
}

export async function saveEmotionCheck(
  supabase: SupabaseClient,
  userId: string,
  pair: string | null,
  answers: EmotionCheckAnswers,
  tradeId?: string | null,
): Promise<{ id: string; emotion_score: number }> {
  const { evaluateEmotionCheck } = await import("@/lib/strategy-brain/emotion-engine")
  const evaluated = evaluateEmotionCheck(answers)

  const { data, error } = await supabase
    .from("strategy_brain_emotion_checks")
    .insert({
      user_id: userId,
      pair,
      trade_id: tradeId ?? null,
      answers,
      emotion_score: evaluated.emotion_score,
      emotion_stable: evaluated.emotion_stable,
      major_news_risk: evaluated.major_news_risk,
    })
    .select("id, emotion_score")
    .single()

  throwIfMissing(error)
  if (error) throw new Error(error.message)
  return data as { id: string; emotion_score: number }
}

export async function upsertPostTradeReview(
  supabase: SupabaseClient,
  userId: string,
  tradeId: string,
  answers: PostTradeReviewAnswers,
): Promise<{ id: string }> {
  const summary = buildPostReviewSummary(answers)
  const { data, error } = await supabase
    .from("strategy_brain_post_reviews")
    .upsert(
      {
        user_id: userId,
        trade_id: tradeId,
        answers,
        review_summary: summary,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,trade_id" },
    )
    .select("id")
    .single()

  throwIfMissing(error)
  if (error) throw new Error(error.message)
  return { id: data.id as string }
}

function buildPostReviewSummary(answers: PostTradeReviewAnswers): string {
  const parts: string[] = []
  if (answers.followed_strategy === false) parts.push("Strategy drift")
  if (answers.valid_loss === true) parts.push("Valid loss")
  if (answers.issue_type === "execution") parts.push("Execution issue")
  if (answers.issue_type === "strategy") parts.push("Strategy issue")
  if (answers.should_repeat?.trim()) parts.push(`Repeat: ${answers.should_repeat.trim()}`)
  return parts.join(" · ") || "Review recorded"
}

export async function getStrategyBrainDashboard(
  supabase: SupabaseClient,
  userId: string,
): Promise<StrategyBrainDashboard> {
  const weekStart = getWeekStartSunday()
  const [marketBias, currentWeekPlan, evalRes] = await Promise.all([
    getMarketBias(supabase, userId),
    getWeeklyPlanWithPairs(supabase, userId, weekStart),
    supabase
      .from("strategy_brain_setup_evaluations")
      .select("id, pair, total_score, grade, recommendation, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  throwIfMissing(evalRes.error)

  return {
    marketBias,
    currentWeekPlan,
    weekStart,
    recentEvaluations: (evalRes.data || []) as StrategyBrainDashboard["recentEvaluations"],
  }
}
