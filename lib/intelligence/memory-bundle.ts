import type { SupabaseClient } from "@supabase/supabase-js"
import { detectPrimaryLeak } from "@/lib/behavior/leak-engine"
import type { LeakEngineInput } from "@/lib/behavior/types"
import {
  generatePatternMemory,
  type PatternMemoryFeedback,
  type PatternMemorySession,
  type PatternMemoryTrade,
} from "@/lib/trade-coach/pattern-memory"
import type { PlannedVsActualComparison, PreTradePlannedContext } from "@/lib/trade-coach/types"
import { listPlannedCoachSessions } from "@/lib/trade-coach/server-service"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import { buildTraderContextMemory } from "@/lib/intelligence/trader-context"
import type { RecentTradeMemory } from "@/lib/intelligence/conversational-types"

function isMissingTableError(error: { message?: string; code?: string } | null) {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|schema cache/i.test(error.message || "")
  )
}

async function loadUserSettings(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("user_settings")
    .select(
      "max_risk_per_trade, max_trades_per_day, command_center_enabled, preferred_session",
    )
    .eq("user_id", userId)
    .maybeSingle()

  return {
    maxRiskPerTrade: data?.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade,
    maxTradesPerDay: data?.max_trades_per_day ?? DEFAULT_USER_SETTINGS.max_trades_per_day,
    enabled: data?.command_center_enabled ?? true,
  }
}

async function loadProfileName(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle()
  return data?.display_name ?? null
}

async function loadTrades(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("trades")
    .select(
      "id, pair, direction, result, pnl, emotion, emotion_after, strategy_name, session, risk_percent, rule_followed, mistake_tags, confirmation_signal, trade_date, created_at, setup, setup_classification",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(300)

  if (error) throw new Error(error.message)
  return data || []
}

async function loadPatternInputs(supabase: SupabaseClient, userId: string, maxRiskPerTrade: number) {
  const trades = (await loadTrades(supabase, userId)) as PatternMemoryTrade[]

  const { data: feedbackRows, error: feedbackError } = await supabase
    .from("trade_coach_feedback")
    .select("trade_id, discipline_score, planned_vs_actual")
    .eq("user_id", userId)

  let feedback: PatternMemoryFeedback[] = []
  if (!feedbackError) {
    feedback = (feedbackRows || []).map((row) => ({
      trade_id: String(row.trade_id),
      discipline_score: row.discipline_score,
      planned_vs_actual: (row.planned_vs_actual || []) as PlannedVsActualComparison[],
    }))
  }

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("trade_coach_sessions")
    .select("trade_id, planned_context")
    .eq("user_id", userId)
    .not("trade_id", "is", null)

  let sessions: PatternMemorySession[] = []
  if (!sessionsError) {
    sessions = (sessionRows || []).map((row) => ({
      trade_id: row.trade_id ? String(row.trade_id) : null,
      planned_context: (row.planned_context || {}) as PreTradePlannedContext,
    }))
  }

  return generatePatternMemory({ trades, feedback, sessions, maxRiskPerTrade })
}

async function loadUnreadSignalCount(supabase: SupabaseClient, userId: string) {
  const { count, error } = await supabase
    .from("tradingview_signals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)

  if (error && !isMissingTableError(error)) return 0
  return count ?? 0
}

export async function buildMemoryBundle(supabase: SupabaseClient, userId: string) {
  const settings = await loadUserSettings(supabase, userId)
  const traderName = await loadProfileName(supabase, userId)
  const trades = await loadTrades(supabase, userId)
  const patternResult = await loadPatternInputs(supabase, userId, settings.maxRiskPerTrade)
  const plannedSessions = await listPlannedCoachSessions(supabase, userId)
  const unreadSignalCount = await loadUnreadSignalCount(supabase, userId)

  const leakTrades: LeakEngineInput["trades"] = trades.map((t) => ({
    id: String(t.id),
    direction: String(t.direction),
    result: String(t.result),
    pnl: Number(t.pnl),
    emotion: String(t.emotion),
    emotion_after: t.emotion_after,
    session: t.session,
    pair: String(t.pair || ""),
    setup: String(t.setup || ""),
    setup_classification: t.setup_classification,
    risk_percent: t.risk_percent,
    rule_followed: t.rule_followed,
    confirmation_signal: t.confirmation_signal,
    mistake_tags: t.mistake_tags,
    trade_date: t.trade_date,
    created_at: String(t.created_at),
    timestamp: new Date(t.created_at).getTime(),
    dayKey: "",
    hourOfDay: 0,
  }))

  const primaryLeak = detectPrimaryLeak({
    trades: leakTrades,
    maxRiskPerTrade: settings.maxRiskPerTrade,
  })

  const memory = buildTraderContextMemory({
    trades,
    maxRiskPerTrade: settings.maxRiskPerTrade,
    maxTradesPerDay: settings.maxTradesPerDay,
    primaryLeak,
    patterns: patternResult.patterns,
    plannedSessions,
    traderName,
    unreadSignalCount,
  })

  return { settings, memory, recentTrades: trades.slice(0, 12) as RecentTradeMemory[], traderName }
}
