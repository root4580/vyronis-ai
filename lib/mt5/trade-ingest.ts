import { parseTradeDate, toLocalCalendarDateKey, toLocalIsoDateTime } from "@/lib/journal/trade-date-parser"
import { getSignedPnL, normalizeTradeResultForDb } from "@/lib/trade-utils"
import type { Mt5TradeWebhookPayload } from "@/lib/mt5/types"
import type { NormalizedResearchTrade } from "@/lib/research/types"

function normalizePair(symbol: string): string {
  const cleaned = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (cleaned.length === 6) {
    return `${cleaned.slice(0, 3)}/${cleaned.slice(3)}`
  }
  return symbol.trim().toUpperCase()
}

function normalizeDirection(raw: string): "BUY" | "SELL" {
  const value = raw.trim().toLowerCase()
  if (value.includes("sell") || value === "1" || value === "short" || value === "s") {
    return "SELL"
  }
  return "BUY"
}

function deriveResult(profit: number): "WIN" | "LOSS" | "BE" {
  if (Math.abs(profit) < 0.005) return "BE"
  return profit > 0 ? "WIN" : "LOSS"
}

function parseMt5DateTime(value: string | undefined): string | null {
  if (!value?.trim()) return null
  const parsed = parseTradeDate(value)
  if (!parsed) return null
  return toLocalIsoDateTime(parsed)
}

function resolveTradeDate(payload: Mt5TradeWebhookPayload): {
  trade_date: string
  opened_at: string | null
  closed_at: string | null
} {
  const closeRaw = payload.close_time?.trim()
  const openRaw = payload.open_time?.trim()
  const dateOnly = payload.trade_date?.trim()

  let closedAt = closeRaw ? parseMt5DateTime(closeRaw) : null
  let openedAt = openRaw ? parseMt5DateTime(openRaw) : null

  if (!closedAt && dateOnly) {
    const parsed = parseTradeDate(dateOnly)
    if (parsed) {
      closedAt = toLocalIsoDateTime(parsed)
    }
  }

  const anchor = closedAt ?? openedAt ?? new Date().toISOString()
  const parsedAnchor = parseTradeDate(anchor)
  const trade_date = parsedAnchor
    ? toLocalCalendarDateKey(parsedAnchor)
    : toLocalCalendarDateKey(new Date())

  return { trade_date, opened_at: openedAt, closed_at: closedAt }
}

export function normalizeMt5WebhookTrade(
  payload: Mt5TradeWebhookPayload,
): NormalizedResearchTrade {
  const profit = Number(payload.profit)
  const result = normalizeTradeResultForDb(deriveResult(profit)) as "WIN" | "LOSS" | "BE"
  const signedPnl = getSignedPnL(profit, result)
  const dates = resolveTradeDate(payload)

  const rawPayload: Record<string, string> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (value == null) continue
    rawPayload[key] = String(value)
  }

  const entryPrice =
    payload.open_price != null && Number.isFinite(Number(payload.open_price))
      ? Number(payload.open_price)
      : null
  const exitPrice =
    payload.close_price != null && Number.isFinite(Number(payload.close_price))
      ? Number(payload.close_price)
      : null

  if (entryPrice != null) rawPayload.open_price = String(entryPrice)
  if (exitPrice != null) rawPayload.close_price = String(exitPrice)

  return {
    external_ticket: String(payload.ticket).trim(),
    pair: normalizePair(payload.symbol),
    direction: normalizeDirection(payload.direction),
    result,
    pnl: signedPnl,
    trade_date: dates.trade_date,
    opened_at: dates.opened_at,
    closed_at: dates.closed_at,
    entry_price: entryPrice,
    lots: payload.volume ?? null,
    commission: payload.commission ?? null,
    swap: payload.swap ?? null,
    stop_loss: payload.sl ?? null,
    take_profit: payload.tp ?? null,
    risk_reward: null,
    magic_number: payload.magic ?? null,
    account_login: payload.account_login != null ? String(payload.account_login) : null,
    broker: payload.broker?.trim() || "MT5",
    trade_notes: payload.comment?.trim() || null,
    session: null,
    raw_payload: rawPayload,
  }
}
