import {
  TRADE_PAIRS,
  TRADING_SESSIONS,
  type TradeFormState,
} from "@/lib/trade-form-config"
import type { Mt5ScreenshotAutofill } from "@/lib/journal/mt5-screenshot-vision-types"

function resolvePair(raw: string): string {
  const key = raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const match = TRADE_PAIRS.find((pair) => pair === key)
  return match ?? (key.length >= 6 ? key.slice(0, 6) : "")
}

function priceDigits(pair: string): number {
  if (pair.startsWith("XAU") || pair.startsWith("XAG")) return 2
  if (pair.includes("JPY")) return 3
  return 5
}

function formatPrice(pair: string, value: number | null): string {
  if (value == null || !pair) return ""
  return value.toFixed(priceDigits(pair))
}

function formatPnL(value: number | null): string {
  if (value == null) return ""
  const abs = Math.abs(value)
  if (abs < 0.005) return "0"
  return abs.toFixed(2)
}

function resolveSession(raw: string | null): string {
  if (!raw) return ""
  return TRADING_SESSIONS.includes(raw) ? raw : ""
}

export function tradeFormPatchFromMt5Autofill(
  autofill: Mt5ScreenshotAutofill,
  current: TradeFormState,
): Partial<TradeFormState> {
  const pair = resolvePair(autofill.pair) || current.pair
  const direction =
    autofill.direction === "BUY" || autofill.direction === "SELL"
      ? autofill.direction
      : current.direction

  const closeNote =
    autofill.close_price != null && pair
      ? `Close ${formatPrice(pair, autofill.close_price)}`
      : ""
  const sessionNote = autofill.session_est_label ? `Time ${autofill.session_est_label}` : ""
  const notesPrefix = [
    autofill.summary ? `MT5: ${autofill.summary}` : "",
    sessionNote,
    closeNote,
  ]
    .filter(Boolean)
    .join(" · ")
  const trade_notes = notesPrefix
    ? current.trade_notes
      ? `${notesPrefix}\n\n${current.trade_notes}`
      : notesPrefix
    : current.trade_notes

  const patch: Partial<TradeFormState> = {
    pair,
    direction,
    entry_price: formatPrice(pair, autofill.entry_price) || current.entry_price,
    stop_loss: formatPrice(pair, autofill.stop_loss) || current.stop_loss,
    take_profit: formatPrice(pair, autofill.take_profit) || current.take_profit,
    trade_notes,
  }

  if (autofill.result) patch.result = autofill.result
  if (autofill.profit != null) patch.pnl = formatPnL(autofill.profit)
  if (autofill.trade_date) patch.trade_date = autofill.trade_date
  const session = resolveSession(autofill.session)
  if (session) patch.session = session

  return patch
}
