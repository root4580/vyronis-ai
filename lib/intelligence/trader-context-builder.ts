import type { SupabaseClient } from "@supabase/supabase-js"
import { buildAdvancedAnalytics, type AnalyticsTrade } from "@/lib/analytics-engine"
import {
  buildEmotionalTrends,
  buildMistakeHeatmap,
} from "@/lib/learning/pattern-detection"
import type { LearningTradeRow } from "@/lib/learning/types"
import { listStrategyPlaybooks } from "@/lib/strategy/server-service"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import {
  buildDailyRules,
  buildRiskSnapshot,
  normalizeUserSettings,
  type UserSettingsForm,
} from "@/lib/user-settings"
import { weeklyReviewRowToReport } from "@/lib/weekly-review/engine"
import type { WeeklyReviewRecord } from "@/lib/weekly-review/types"
import type { RecentTradeMemory } from "@/lib/intelligence/conversational-types"
import type {
  CommandCenterMemoryInsight,
  EmotionalStateSnapshot,
  FullTraderContext,
} from "@/lib/intelligence/intelligence-types"
import type { CommandCenterMessageRecord } from "@/lib/command-center/types"
import { buildAutonomousIntelligenceSnapshot } from "@/lib/autonomous/orchestrator"
import { buildCognitiveIntelligenceSnapshot } from "@/lib/cognitive/orchestrator"
import { buildTradingOsSnapshot } from "@/lib/trading-os/orchestrator"
import { buildAdaptiveCognitionSnapshot } from "@/lib/adaptive-cognition/orchestrator"
import { loadLifeContextHistory } from "@/lib/adaptive-cognition/server-service"
import { buildVyronisCoreSnapshot } from "@/lib/vyronis-core/orchestrator"
import { loadRecentLessons } from "@/lib/autonomous/server-service"
import { buildMemoryBundle } from "@/lib/intelligence/memory-bundle"
import { loadRecentOutcomeLessons } from "@/lib/learning/outcome-lessons-service"
import { loadTraderStateTimeline } from "@/lib/intelligence/cognitive-snapshot-service"
import { computeVerdictCalibration } from "@/lib/intelligence/verdict-calibration-engine"
import { toneMemoryFromMessages } from "@/lib/intelligence/tone-memory-engine"

const IMPULSIVE_EMOTIONS = new Set([
  "fomo",
  "revenge",
  "euphoric",
  "anxious",
  "tilted",
  "frustrated",
  "impulsive",
])

const EXTENDED_TRADE_SELECT =
  "id, pair, direction, result, pnl, emotion, emotion_after, strategy_name, session, risk_percent, rule_followed, mistake_tags, confirmation_signal, trade_date, created_at, setup, setup_classification, risk_reward, entry_price, stop_loss, take_profit, higher_timeframe"

async function loadExtendedTrades(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("trades")
    .select(EXTENDED_TRADE_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) throw new Error(error.message)
  return data || []
}

async function loadUserSettingsRecord(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("user_settings")
    .select(
      "starting_balance, daily_drawdown_limit, max_risk_per_trade, max_trades_per_day, prop_firm_size, profit_target, preferred_session",
    )
    .eq("user_id", userId)
    .maybeSingle()

  return normalizeUserSettings(data)
}

async function loadLatestWeeklyReview(
  supabase: SupabaseClient,
  userId: string,
): Promise<FullTraderContext["weeklyReview"]> {
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  try {
    return weeklyReviewRowToReport(data as WeeklyReviewRecord)
  } catch {
    return null
  }
}

async function loadMemoryInsights(
  supabase: SupabaseClient,
  userId: string,
  limit = 12,
): Promise<CommandCenterMemoryInsight[]> {
  const { data, error } = await supabase
    .from("command_center_memory_insights")
    .select("id, category, insight, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return []
    throw new Error(error.message)
  }

  return (data || []).map((row) => ({
    id: String(row.id),
    category: row.category as CommandCenterMemoryInsight["category"],
    insight: String(row.insight),
    created_at: String(row.created_at),
    metadata: (row.metadata || {}) as Record<string, unknown>,
  }))
}

function buildEmotionalState(trades: RecentTradeMemory[]): EmotionalStateSnapshot {
  const trends = buildEmotionalTrends(trades as LearningTradeRow[])
  const recentEmotions = trades.slice(0, 5).map((t) => t.emotion).filter(Boolean)
  const dominantEmotion = trends[0]?.emotion ?? recentEmotions[0] ?? null
  const impulsiveCount = recentEmotions.filter((e) =>
    IMPULSIVE_EMOTIONS.has(e.toLowerCase()),
  ).length

  let trend: EmotionalStateSnapshot["trend"] = "stable"
  if (impulsiveCount >= 2) trend = "volatile"
  else if (impulsiveCount === 1 || trends[0]?.trend === "risky") trend = "elevated"

  const note =
    trend === "volatile"
      ? "Recent emotions look elevated — worth pausing before new risk."
      : trend === "elevated"
        ? "One impulsive emotion in recent trades — stay deliberate."
        : "Emotional tone looks relatively stable in recent trades."

  return { dominantEmotion, impulsiveCount, recentEmotions, trend, note }
}

function sessionItemToPlannedContext(item: FullTraderContext["memory"]["plannedSessions"][0]): PreTradePlannedContext {
  return {
    pair: item.pair ?? undefined,
    direction: item.direction ?? undefined,
    emotion: item.emotion ?? undefined,
    risk_percent: item.risk ?? undefined,
    strategy_name: item.strategy_name ?? null,
    setup: item.plan_summary || undefined,
  }
}

function resolveActivePlannedContext(
  plannedSessions: FullTraderContext["memory"]["plannedSessions"],
  focusId?: string | null,
): PreTradePlannedContext | null {
  if (focusId) {
    const match = plannedSessions.find((s) => s.id === focusId)
    if (match) return sessionItemToPlannedContext(match)
  }
  return plannedSessions[0] ? sessionItemToPlannedContext(plannedSessions[0]) : null
}

export async function buildFullTraderContext(
  supabase: SupabaseClient,
  userId: string,
  input?: {
    focusId?: string | null
    recentMessages?: CommandCenterMessageRecord[]
  },
): Promise<FullTraderContext> {
  const { memory, traderName } = await buildMemoryBundle(supabase, userId)
  const settings = await loadUserSettingsRecord(supabase, userId)
  const extendedTrades = await loadExtendedTrades(supabase, userId)
  const playbooks = await listStrategyPlaybooks(supabase, userId).catch(() => [])
  const weeklyReview = await loadLatestWeeklyReview(supabase, userId)
  const compressedMemories = await loadMemoryInsights(supabase, userId)

  const recentTrades = extendedTrades.slice(0, 20) as RecentTradeMemory[]
  const analyticsTrades: AnalyticsTrade[] = extendedTrades.map((t) => ({
    pair: String(t.pair || ""),
    result: String(t.result),
    pnl: Number(t.pnl),
    session: t.session ?? null,
    emotion: String(t.emotion || ""),
    rule_followed: t.rule_followed ?? null,
    created_at: String(t.created_at),
    trade_date: t.trade_date ?? null,
  }))

  const analytics = buildAdvancedAnalytics(analyticsTrades)
  const mistakeHeatmap = buildMistakeHeatmap(extendedTrades as LearningTradeRow[])
  const emotionalState = buildEmotionalState(recentTrades)
  const risk = buildRiskSnapshot(settings, extendedTrades, settings.starting_balance)
  const dailyRules = buildDailyRules(settings, extendedTrades, settings.starting_balance)

  let recentMessages: FullTraderContext["recentMessages"] = input?.recentMessages ?? []

  const baseContext: FullTraderContext = {
    traderName,
    preferredSession: settings.preferred_session ?? "NY Session",
    settings,
    risk,
    dailyRules,
    memory,
    recentTrades,
    mistakeHeatmap,
    emotionalState,
    sessionPerformance: analytics.sessionPerformance,
    weeklyReview,
    playbooks,
    compressedMemories,
    recentMessages,
    activePlannedContext: resolveActivePlannedContext(
      memory.plannedSessions,
      input?.focusId,
    ),
    autonomous: null,
  }

  const autonomous = buildAutonomousIntelligenceSnapshot({
    context: baseContext,
    plannedContext: baseContext.activePlannedContext,
    trigger: "context_load",
  })

  const dbLessons = await loadRecentLessons(supabase, userId, 5).catch(() => [])
  if (dbLessons.length > 0) {
    autonomous.recentLessons = [...new Set([...dbLessons, ...autonomous.recentLessons])].slice(0, 5)
  }

  const withAutonomous = { ...baseContext, autonomous }

  const cognitive = buildCognitiveIntelligenceSnapshot({
    context: withAutonomous,
    chartVision: undefined,
  })

  const withCognitive = { ...withAutonomous, cognitive }

  const tradingOs = buildTradingOsSnapshot({
    context: withCognitive,
    lastKnownSession: null,
  })

  const withTradingOs = { ...withCognitive, tradingOs }

  const lifeContextHistory = await loadLifeContextHistory(supabase, userId, 14).catch(() => [])

  const adaptiveCognition = buildAdaptiveCognitionSnapshot({
    context: withTradingOs,
    lifeContextHistory,
  })

  const withAdaptive = { ...withTradingOs, adaptiveCognition }

  const vyronisCore = buildVyronisCoreSnapshot({ context: withAdaptive })

  const outcomeLessons = await loadRecentOutcomeLessons(supabase, userId, 8).catch(() => [])

  const traderStateTimeline = await loadTraderStateTimeline(
    supabase,
    userId,
    tradingOs?.liveSession.emotionalDriftScore,
  ).catch(() => null)

  const verdictCalibration = computeVerdictCalibration(outcomeLessons)
  const toneMemory = toneMemoryFromMessages(recentMessages)

  return {
    ...withAdaptive,
    vyronisCore,
    outcomeLessons,
    traderStateTimeline,
    verdictCalibration,
    toneMemory,
  }
}

export function serializeTraderContextForLlm(
  context: FullTraderContext,
  depth: "lite" | "full" = "full",
): string {
  if (depth === "lite") {
    const lite = {
      traderName: context.traderName,
      today: context.memory.snapshot,
      emotionalState: context.emotionalState,
      primaryLeak: context.memory.primaryLeak.status === "active"
        ? context.memory.primaryLeak.headline
        : null,
      riskToday: `${context.risk.todayLossPercent.toFixed(1)}% drawdown used`,
      outcomeHints: (context.outcomeLessons ?? []).slice(0, 2).map((l) => l.naturalReference),
    }
    return JSON.stringify(lite, null, 2)
  }
  const payload = {
    traderName: context.traderName,
    preferredSession: context.preferredSession,
    propFirm: context.settings.prop_firm_size,
    riskLimits: {
      maxRiskPerTrade: context.settings.max_risk_per_trade,
      maxTradesPerDay: context.settings.max_trades_per_day,
      dailyDrawdownLimit: context.settings.daily_drawdown_limit,
      profitTarget: context.settings.profit_target,
    },
    riskSnapshot: context.risk,
    dailyRules: context.dailyRules.filter((r) => !r.checked).map((r) => r.rule),
    today: context.memory.snapshot,
    primaryLeak: context.memory.primaryLeak,
    topPatterns: context.memory.topPatterns.slice(0, 5),
    warnings: context.memory.warnings.slice(0, 6),
    recentTrades: context.recentTrades.slice(0, 10).map((t) => ({
      pair: t.pair,
      direction: t.direction,
      result: t.result,
      pnl: t.pnl,
      emotion: t.emotion,
      session: t.session,
      date: t.trade_date || t.created_at,
    })),
    mistakeHeatmap: context.mistakeHeatmap.slice(0, 6),
    emotionalState: context.emotionalState,
    sessionPerformance: context.sessionPerformance.slice(0, 5),
    weeklyReview: context.weeklyReview
      ? {
          weekLabel: context.weeklyReview.weekLabel,
          headline: context.weeklyReview.headline,
          winRate: context.weeklyReview.winRate,
          recurringMistakes: context.weeklyReview.recurringMistakes.slice(0, 5),
          weakestHabit: context.weeklyReview.weakestHabit,
          strongestSession: context.weeklyReview.strongestSession,
          improvementPlan: context.weeklyReview.improvementPlan.slice(0, 3),
        }
      : null,
    playbooks: context.playbooks.slice(0, 4).map((p) => ({
      name: p.strategy_name,
      isDefault: p.is_default,
      rrMinimum: p.rr_minimum,
    })),
    longTermMemories: context.compressedMemories.slice(0, 8).map((m) => ({
      category: m.category,
      insight: m.insight,
    })),
    activePlannedSetup: context.activePlannedContext
      ? {
          pair: context.activePlannedContext.pair,
          direction: context.activePlannedContext.direction,
          setup: context.activePlannedContext.setup,
          session: context.activePlannedContext.session,
          emotion: context.activePlannedContext.emotion,
          riskPercent: context.activePlannedContext.risk_percent,
          htf: context.activePlannedContext.higher_timeframe,
        }
      : null,
    autonomous: context.autonomous
      ? {
          shadow: {
            emotionalRisk: context.autonomous.shadow.emotionalRiskScore,
            disciplineConfidence: context.autonomous.shadow.disciplineConfidence,
            executionQuality: context.autonomous.shadow.executionQualityPrediction,
            proactiveMessage: context.autonomous.shadow.proactiveMessage,
            flags: context.autonomous.shadow.flags,
          },
          session: {
            phase: context.autonomous.session.phase,
            context: context.autonomous.session.marketContext,
            narrative: context.autonomous.session.narrative,
            bias: context.autonomous.session.tradingBias,
          },
          traderDna: {
            archetype: context.autonomous.traderDna.archetype,
            bestSetups: context.autonomous.traderDna.bestSetupTypes,
            recurringMistakes: context.autonomous.traderDna.recurringMistakes,
            weeklyInsight: context.autonomous.traderDna.weeklyInsight,
          },
          patternMatch: context.autonomous.patternMatch.narrative,
          nudges: context.autonomous.proactiveNudges.map((n) => n.message),
        }
      : null,
    cognitive: context.cognitive
      ? {
          state: context.cognitive.state.primary,
          coachingMode: context.cognitive.coaching.mode,
          marketEnvironment: context.cognitive.marketEnvironment.labels,
          strictness: context.cognitive.state.verdictStrictness,
          confidenceGraph: context.cognitive.confidenceGraph.narrative,
          crossMemory: context.cognitive.memory.crossMemorySynthesis,
          predictions: context.cognitive.predictions.narrative,
        }
      : null,
    tradingOs: context.tradingOs
      ? {
          headline: context.tradingOs.proactiveHeadline,
          intervention: context.tradingOs.intervention.active
            ? context.tradingOs.intervention.message
            : null,
          canProceed: context.tradingOs.intervention.canProceedToEntry,
          alerts: context.tradingOs.liveSession.alerts.map((a) => a.message),
          evolutionScore: context.tradingOs.evolution.overallEvolutionScore,
          strategy: context.tradingOs.strategy.adaptiveGuidance,
        }
      : null,
    adaptiveCognition: context.adaptiveCognition
      ? {
          philosophy: context.adaptiveCognition.ecosystem.philosophy,
          becoming: context.adaptiveCognition.identity.becoming,
          headline: context.adaptiveCognition.headline,
          insights: context.adaptiveCognition.insights.map((i) => i.message),
          personalMode: context.adaptiveCognition.personalOs.recommendedMode,
          luckyWinWarning: context.adaptiveCognition.performance.luckyWinWarning,
          companionStyle: context.adaptiveCognition.companion.communicationStyle,
        }
      : null,
    vyronisCore: context.vyronisCore
      ? {
          maturity: context.vyronisCore.overallMaturity,
          phaseFocus: context.vyronisCore.currentPhaseFocus,
          headline: context.vyronisCore.headline,
          preTradeApproval: context.vyronisCore.phase5.preTradeApproval,
          intervention: context.vyronisCore.phase5.interventionPrompt,
        }
      : null,
  }

  return JSON.stringify(payload, null, 2)
}
