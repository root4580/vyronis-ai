import { parseMistakeTags } from "@/lib/trade-form-config"
import { createInitialTradeForm, type TradeFormState } from "@/lib/trade-form-config"
import { formatRiskPercentForForm } from "@/lib/trade-form-utils"

/** Marker stored in trade_notes for analytics — repeat-last quick log */
export const REPEAT_LOG_NOTE_MARKER = "[vyronis-repeat-last]"

export type RepeatLogSourceTrade = {
  pair: string
  direction: string
  emotion: string
  emotion_after?: string | null
  setup: string
  strategy_name?: string | null
  risk_percent?: number | null
  rule_followed?: boolean | null
  session?: string | null
  screenshot_url?: string | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
  higher_timeframe?: string | null
  entry_timeframe?: string | null
  confirmation_timeframe?: string | null
  confirmation_signal?: string | null
  mistake_tags?: string | null
  trade_notes?: string | null
}

export function isRepeatLoggedTrade(notes: string | null | undefined): boolean {
  return Boolean(notes?.includes(REPEAT_LOG_NOTE_MARKER))
}

export function getMostRecentTradeForRepeat<T extends { created_at: string; trade_date?: string | null }>(
  trades: T[],
): T | null {
  if (trades.length === 0) return null
  return [...trades].sort(
    (a, b) =>
      new Date(b.trade_date || b.created_at).getTime() -
      new Date(a.trade_date || a.created_at).getTime(),
  )[0]
}

export function buildRepeatTradeDraft(source: RepeatLogSourceTrade): TradeFormState {
  const base = createInitialTradeForm()
  const cleanedNotes = (source.trade_notes || "")
    .replace(REPEAT_LOG_NOTE_MARKER, "")
    .trim()

  return {
    ...base,
    pair: source.pair,
    direction: source.direction,
    setup: source.setup || base.setup,
    strategy_name: source.strategy_name || "",
    risk_percent: formatRiskPercentForForm(source.risk_percent),
    rule_followed: source.rule_followed !== false,
    session: source.session || "",
    screenshot_url: source.screenshot_url || "",
    entry_price: source.entry_price?.toString() || "",
    stop_loss: source.stop_loss?.toString() || "",
    take_profit: source.take_profit?.toString() || "",
    higher_timeframe: source.higher_timeframe || "",
    entry_timeframe: source.entry_timeframe || "",
    confirmation_timeframe: source.confirmation_timeframe || "",
    confirmation_signal: source.confirmation_signal || "",
    emotion: "Calm",
    emotion_after: "",
    result: "",
    pnl: "",
    mistake_tags: [],
    trade_notes: cleanedNotes
      ? `${REPEAT_LOG_NOTE_MARKER}\n${cleanedNotes}`
      : REPEAT_LOG_NOTE_MARKER,
    trade_date: new Date().toISOString().split("T")[0],
  }
}

export function appendRepeatMarkerToNotes(notes: string): string {
  if (notes.includes(REPEAT_LOG_NOTE_MARKER)) return notes
  return notes.trim() ? `${REPEAT_LOG_NOTE_MARKER}\n${notes.trim()}` : REPEAT_LOG_NOTE_MARKER
}

export function stripRepeatMarkerFromNotes(notes: string | null | undefined): string {
  if (!notes) return ""
  return notes.replace(REPEAT_LOG_NOTE_MARKER, "").trim()
}

export function preserveRepeatMarkerOnEdit(
  previousNotes: string | null | undefined,
  nextNotes: string,
): string {
  if (!isRepeatLoggedTrade(previousNotes)) return nextNotes
  if (isRepeatLoggedTrade(nextNotes)) return nextNotes
  return appendRepeatMarkerToNotes(nextNotes)
}
