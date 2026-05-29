import {
  getRawTradeDateTime,
  logJournalImportDateDebug,
  parseTradeDate,
  resolveTradeDateFromRow,
  toLocalIsoDateTime,
} from "@/lib/journal/trade-date-parser"
import { parseCsvProfit } from "@/lib/journal/journal-csv-mapper"
import { normalizeTradeResultForDb } from "@/lib/trade-utils"
import type { Mt5CsvRow, NormalizedResearchTrade } from "@/lib/research/types"

function parseNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const cleaned = value.replace(/[^\d.-]/g, "")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function readProfit(row: Mt5CsvRow): number {
  const raw =
    row.pnl?.trim() ||
    row.profit?.trim() ||
    row["net_profit"]?.trim() ||
    ""
  return parseCsvProfit(raw)
}

function resultLabelFromPnl(pnl: number): "WIN" | "LOSS" | "BE" {
  if (Math.abs(pnl) < 0.005) return "BE"
  return pnl > 0 ? "WIN" : "LOSS"
}

function parseMt5DateTime(value: string | undefined): string | null {
  if (!value?.trim()) return null
  const parsed = parseTradeDate(value)
  if (!parsed) return null
  return toLocalIsoDateTime(parsed)
}

type ResolvedRowDates = {
  trade_date: string
  closed_at: string | null
  opened_at: string | null
  sessionAnchor: string | null
  trade_time: string | null
  rawDateValue: string
}

function resolveRowTradeDates(row: Mt5CsvRow, rowNumber: number, profit: number): ResolvedRowDates {
  const resolved = resolveTradeDateFromRow(row)
  if (!resolved) {
    const raw = getRawTradeDateTime(row)
    throw new Error(
      `Row ${rowNumber}: no valid Date or Time column${raw ? ` (found "${raw}" but could not parse)` : ""}.`,
    )
  }

  logJournalImportDateDebug({
    rowNumber,
    ticket: row.ticket || row.deal || row.position,
    originalCsvDateTime: resolved.rawDateValue,
    parsedDate: resolved.isoDateTime ?? `${resolved.calendarDateKey}T00:00:00`,
    groupedCalendarDate: resolved.calendarDateKey,
    tradeProfit: profit,
    tradeTime: resolved.tradeTime,
  })

  const closeRaw = row.close_time?.trim()
  const openRaw = row.open_time?.trim()
  let closedAt: string | null = null
  let openedAt: string | null = null

  if (closeRaw && parseTradeDate(closeRaw)) {
    closedAt = parseMt5DateTime(closeRaw)
  } else if (!resolved.dateOnly && resolved.isoDateTime) {
    closedAt = resolved.isoDateTime
  }

  if (openRaw && parseTradeDate(openRaw)) {
    openedAt = parseMt5DateTime(openRaw)
  }

  return {
    trade_date: resolved.calendarDateKey,
    closed_at: closedAt,
    opened_at: openedAt,
    sessionAnchor: closedAt ?? openedAt,
    trade_time: resolved.tradeTime,
    rawDateValue: resolved.rawDateValue,
  }
}

function resolveRowTradeDatesSoft(
  row: Mt5CsvRow,
  rowNumber: number,
  profit: number,
): { dates: ResolvedRowDates | null; needsDateFix: boolean; message?: string } {
  try {
    return { dates: resolveRowTradeDates(row, rowNumber, profit), needsDateFix: false }
  } catch (error) {
    const raw =
      getRawTradeDateTime(row) ??
      row.date?.trim() ??
      row.trade_date?.trim() ??
      null
    return {
      dates: null,
      needsDateFix: true,
      message:
        error instanceof Error
          ? error.message
          : raw
            ? `Row ${rowNumber}: could not parse date "${raw}".`
            : `Row ${rowNumber}: add a Date column (YYYY-MM-DD).`,
    }
  }
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
  if (!value) return null
  if (value.includes("buy") || value === "0" || value === "long" || value === "b") return "BUY"
  if (value.includes("sell") || value === "1" || value === "short" || value === "s") return "SELL"
  return null
}

function readDirection(row: Mt5CsvRow): "BUY" | "SELL" | null {
  return (
    normalizeDirection(row.type ?? "") ??
    normalizeDirection(row.direction ?? "") ??
    normalizeDirection(row.side ?? "") ??
    null
  )
}

function readSymbol(row: Mt5CsvRow): string {
  return (
    row.pair?.trim() ||
    row.symbol?.trim() ||
    row.item?.trim() ||
    row.instrument?.trim() ||
    ""
  )
}

function readTicket(row: Mt5CsvRow, rowNumber: number): string {
  return (
    row.ticket?.trim() ||
    row.deal?.trim() ||
    row.position?.trim() ||
    row.order?.trim() ||
    `csv-row-${rowNumber}`
  )
}

function deriveResult(profit: number): "WIN" | "LOSS" | "BE" {
  if (Math.abs(profit) < 0.005) return "BE"
  return profit > 0 ? "WIN" : "LOSS"
}

function inferSession(closedAt: string | null): string | null {
  if (!closedAt) return null
  const hour = new Date(closedAt).getHours()
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

export type NormalizeCsvRowResult =
  | { status: "ok"; rowNumber: number; trade: NormalizedResearchTrade }
  | {
      status: "needs_date_fix"
      rowNumber: number
      message: string
      ticket?: string
      pair?: string
      direction?: string
      pnl?: number
      rawDateValue?: string
    }
  | {
      status: "error"
      rowNumber: number
      message: string
      ticket?: string
      pair?: string
      direction?: string
      pnl?: number
    }

function buildNormalizedTrade(
  row: Mt5CsvRow,
  rowNumber: number,
  dates: ResolvedRowDates,
): NormalizedResearchTrade {
  const ticket = readTicket(row, rowNumber)
  const symbol = readSymbol(row)
  const direction = readDirection(row)

  if (!symbol) {
    throw new Error(`Row ${rowNumber}: missing symbol/pair column.`)
  }

  if (!direction) {
    const typeRaw = row.type || row.direction || row.side || ""
    throw new Error(
      `Row ${rowNumber}: could not parse direction from "${typeRaw}". Use Type, Direction, or Side.`,
    )
  }

  const profit = readProfit(row)

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
    trade_date: dates.trade_date,
    opened_at: dates.opened_at,
    closed_at: dates.closed_at,
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
    session: inferSession(dates.sessionAnchor),
    raw_payload: row,
  }
}

export function normalizeMt5CsvRowSoft(row: Mt5CsvRow, rowNumber: number): NormalizeCsvRowResult {
  try {
    const profit = readProfit(row)

    const dateResult = resolveRowTradeDatesSoft(row, rowNumber, profit)

    if (dateResult.needsDateFix || !dateResult.dates) {
      return {
        status: "needs_date_fix",
        rowNumber,
        message: dateResult.message ?? `Row ${rowNumber}: needs date fix.`,
        ticket: readTicket(row, rowNumber),
        pair: readSymbol(row) || undefined,
        direction: readDirection(row) ?? undefined,
        pnl: profit,
        rawDateValue: row.date ?? row.trade_date ?? getRawTradeDateTime(row) ?? undefined,
      }
    }

    const trade = buildNormalizedTrade(row, rowNumber, dateResult.dates)
    return { status: "ok", rowNumber, trade }
  } catch (error) {
    const profit = readProfit(row)

    return {
      status: "error",
      rowNumber,
      message: error instanceof Error ? error.message : `Row ${rowNumber}: invalid trade row`,
      ticket: readTicket(row, rowNumber),
      pair: readSymbol(row) || undefined,
      direction: readDirection(row) ?? undefined,
      pnl: profit,
    }
  }
}

export function normalizeMt5CsvRow(row: Mt5CsvRow, rowNumber: number): NormalizedResearchTrade {
  const outcome = normalizeMt5CsvRowSoft(row, rowNumber)
  if (outcome.status === "ok") return outcome.trade
  throw new Error(outcome.message)
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
      const outcome = normalizeMt5CsvRowSoft(row, rowNumber)
      if (outcome.status === "ok") {
        trades.push(outcome.trade)
      } else {
        throw new Error(outcome.message)
      }
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
