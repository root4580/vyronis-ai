import type { SupabaseClient } from "@supabase/supabase-js"
import type { SignalMemoryTrade } from "@/lib/tradingview/why-engine"

export async function loadSignalMemoryTrades(
  supabase: SupabaseClient,
  userId: string,
  limit = 40,
): Promise<SignalMemoryTrade[]> {
  const [{ data: trades, error }, { data: feedbackRows }] = await Promise.all([
    supabase
      .from("trades")
      .select(
        "id, pair, direction, result, pnl, emotion, session, strategy_name, mistake_tags, confirmation_signal, risk_reward, higher_timeframe, rule_followed, trade_notes, entry_timeframe",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("trade_coach_feedback")
      .select("trade_id, discipline_score")
      .eq("user_id", userId),
  ])

  if (error || !trades) return []

  const disciplineByTrade = new Map(
    (feedbackRows || []).map((row) => [String(row.trade_id), Number(row.discipline_score) || 0]),
  )

  return trades.map((row) => ({
    id: String(row.id),
    pair: String(row.pair || ""),
    direction: String(row.direction || ""),
    result: String(row.result || ""),
    pnl: Number(row.pnl) || 0,
    emotion: row.emotion ? String(row.emotion) : null,
    session: row.session ? String(row.session) : null,
    setup: row.strategy_name ? String(row.strategy_name) : null,
    setup_classification: row.strategy_name ? String(row.strategy_name) : null,
    mistake_tags: row.mistake_tags ? String(row.mistake_tags) : null,
    confirmation_signal: row.confirmation_signal ? String(row.confirmation_signal) : null,
    risk_reward: row.risk_reward != null ? Number(row.risk_reward) : null,
    higher_timeframe: row.higher_timeframe ? String(row.higher_timeframe) : null,
    rule_followed: row.rule_followed === null ? null : Boolean(row.rule_followed),
    discipline_score: disciplineByTrade.get(String(row.id)) ?? null,
    entry_timeframe: row.entry_timeframe ? String(row.entry_timeframe) : null,
    trade_notes: row.trade_notes ? String(row.trade_notes) : null,
  }))
}
