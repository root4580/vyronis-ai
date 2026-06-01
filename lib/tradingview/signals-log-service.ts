import type { SupabaseClient } from "@supabase/supabase-js"
import type { StrategyFilterRejectReason } from "@/lib/tradingview/strategy-filters"

export type TradingViewSignalsLogInsert = {
  user_id: string
  symbol: string
  direction: string
  timeframe?: string | null
  strategy_name?: string | null
  raw_payload: Record<string, unknown>
  passed: boolean
  reject_reason?: StrategyFilterRejectReason | null
  reject_message?: string | null
  notification_message?: string | null
  setup_grade?: string | null
  tradingview_signal_id?: string | null
  trade_plan_id?: string | null
  coach_session_id?: string | null
}

export class TradingViewSignalsLogTableMissingError extends Error {
  constructor(message = "Run supabase/033-tradingview-signals-log.sql in Supabase SQL Editor, then retry.") {
    super(message)
    this.name = "TradingViewSignalsLogTableMissingError"
  }
}

function isMissingLogTableError(message: string): boolean {
  return /tradingview_signals_log|does not exist|PGRST205/i.test(message)
}

export async function logTradingViewWebhookDecision(
  supabase: SupabaseClient,
  row: TradingViewSignalsLogInsert,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("tradingview_signals_log")
    .insert({
      user_id: row.user_id,
      symbol: row.symbol,
      direction: row.direction,
      timeframe: row.timeframe ?? null,
      strategy_name: row.strategy_name ?? null,
      raw_payload: row.raw_payload,
      passed: row.passed,
      reject_reason: row.reject_reason ?? null,
      reject_message: row.reject_message ?? null,
      notification_message: row.notification_message ?? null,
      setup_grade: row.setup_grade ?? null,
      tradingview_signal_id: row.tradingview_signal_id ?? null,
      trade_plan_id: row.trade_plan_id ?? null,
      coach_session_id: row.coach_session_id ?? null,
    })
    .select("id")
    .maybeSingle()

  if (error) {
    if (isMissingLogTableError(error.message)) {
      throw new TradingViewSignalsLogTableMissingError()
    }
    console.error("tradingview_signals_log insert failed:", error.message)
    return null
  }

  return data?.id ? String(data.id) : null
}

export type TradingViewWebhookLogRow = {
  id: string
  symbol: string
  direction: string
  timeframe: string | null
  passed: boolean
  reject_reason: string | null
  reject_message: string | null
  notification_message: string | null
  setup_grade: string | null
  received_at: string
}

export async function listRecentTradingViewWebhookLogs(
  supabase: SupabaseClient,
  userId: string,
  limit = 8,
): Promise<TradingViewWebhookLogRow[]> {
  const { data, error } = await supabase
    .from("tradingview_signals_log")
    .select(
      "id, symbol, direction, timeframe, passed, reject_reason, reject_message, notification_message, setup_grade, received_at",
    )
    .eq("user_id", userId)
    .order("received_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingLogTableError(error.message)) return []
    throw new Error(error.message)
  }

  return (data ?? []) as TradingViewWebhookLogRow[]
}

export async function countTradingViewWebhookLogs(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("tradingview_signals_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)

  if (error) {
    if (isMissingLogTableError(error.message)) return 0
    return 0
  }

  return count ?? 0
}
