import { normalizeTradeResultForDb } from "@/lib/trade-utils"
import type { Mt5CsvRow, NormalizedResearchTrade } from "@/lib/research/types"

function parseNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const cleaned = value.replace(/[^\d.-]/g, "")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function parseMt5DateTime(value: string | undefined): string | null {
  if (!value?.trim()) return null
  const normalized = value.trim().replace(/\./g, "-")
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function toTradeDate(iso: string | null): string {
  if (!iso) {
    const today = new Date()
    return today.toISOString().slice(0, 10)
  }
  return iso.slice(0, 10)
}

function normalizePair(symbol: string): string {
  const cleaned = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (cleaned.length === 6) {
    return `${cleaned.slice(0, 3)}/${cleaned.slice(3)}`
  }
  return symbol.trim().toUpperCase()
}

function normalizeDirection(rawType: string): "BUY" | "SELL" | null {
  const value = rawType.trim().toLowerCase()
  if (value.includes("buy") || value === "0" || value === "long") return "BUY"
  if (value.includes("sell") || value === "1" || value === "short") return "SELL"
  return null
}

function deriveResult(profit: number): "WIN" | "LOSS" | "BE" {
  if (Math.abs(profit) < 0.005) return "BE"
  return profit > 0 ? "WIN" : "LOSS"
}

function inferSession(closedAt: string | null): string | null {
  if (!closedAt) return null
  const hour = new Date(closedAt).getUTCHours()
  if (hour >= 7 && hour < 12) return "London Session"
  if (hour >= 12 && hour < 17) return "NY Session"
  if (hour >= 0 && hour < 7) return "Asian Session"
  return "Other"
}

function computeRiskReward(
  openPrice: number | null,
  closePrice: number | null,
  stopLoss: number | null,
  direction: "BUY" | "SELL",
): number | null {
  if (openPrice == null || stopLoss == null || openPrice === stopLoss) return null
  const risk = Math.abs(openPrice - stopLoss)
  if (risk <= 0) return null
  const reward =
    direction === "BUY"
      ? (closePrice ?? openPrice) - openPrice
      : openPrice - (closePrice ?? openPrice)
  if (reward <= 0) return null
  return Math.round((reward / risk) * 100) / 100
}

export function normalizeMt5CsvRow(row: Mt5CsvRow, rowNumber: number): NormalizedResearchTrade {
  const ticket =
    row.ticket?.trim() ||
    row.deal?.trim() ||
    row.position?.trim() ||
    row.order?.trim() ||
    ""

  const symbol = row.symbol?.trim() || row.item?.trim() || ""
  const typeRaw = row.type?.trim() || ""
  const direction = normalizeDirection(typeRaw)

  if (!ticket) {
    throw new Error(`Row ${rowNumber}: missing ticket/deal/position id.`)
  }

  if (!symbol) {
    throw new Error(`Row ${rowNumber}: missing symbol.`)
  }

  if (!direction) {
    throw new Error(`Row ${rowNumber}: could not parse trade direction from "${typeRaw}".`)
  }

  const profit =
    parseNumber(row.profit) ??
    parseNumber(row.pnl) ??
    parseNumber(row["net_profit"]) ??
    0

  const closedAt = parseMt5DateTime(row.close_time) ?? parseMt5DateTime(row.time)
  const openedAt = parseMt5DateTime(row.open_time) ?? null

  const openPrice = parseNumber(row.open_price)
  const closePrice = parseNumber(row.close_price)
  const stopLoss = parseNumber(row.sl)
  const takeProfit = parseNumber(row.tp)

  const result = normalizeTradeResultForDb(deriveResult(profit)) as "WIN" | "LOSS" | "BE"
  const signedPnl = result === "LOSS" ? -Math.abs(profit) : result === "BE" ? 0 : Math.abs(profit)

  return {
    external_ticket: ticket,
    pair: normalizePair(symbol),
    direction,
    result,
    pnl: signedPnl,
    trade_date: toTradeDate(closedAt ?? openedAt),
    opened_at: openedAt,
    closed_at: closedAt,
    lots: parseNumber(row.volume),
    commission: parseNumber(row.commission),
    swap: parseNumber(row.swap),
    stop_loss: stopLoss,
    take_profit: takeProfit,
    risk_reward: computeRiskReward(openPrice, closePrice, stopLoss, direction),
    magic_number: parseNumber(row.magic ?? undefined),
    account_login: row.account?.trim() || null,
    broker: "MT5 Demo",
    trade_notes: row.comment?.trim() || null,
    session: inferSession(closedAt ?? openedAt),
    raw_payload: row,
  }
}

export function normalizeMt5CsvRows(rows: Mt5CsvRow[]): {
  trades: NormalizedResearchTrade[]
  errors: Array<{ row: number; message: string; ticket?: string }>
} {
  const trades: NormalizedResearchTrade[] = []
  const errors: Array<{ row: number; message: string; ticket?: string }> = []

  rows.forEach((row, index) => {
    const rowNumber = index + 2
    try {
      trades.push(normalizeMt5CsvRow(row, rowNumber))
    } catch (error) {
      errors.push({
        row: rowNumber,
        ticket: row.ticket || row.deal || row.position,
        message: error instanceof Error ? error.message : "Invalid row",
      })
    }
  })

  return { trades, errors }
}
