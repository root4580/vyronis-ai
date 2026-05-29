/**
 * Universal journal CSV row mapping (TradeZella, MT5, simple Date/Profit exports).
 */
import type { Mt5CsvRow } from "@/lib/research/types"
import {
  inferTradeDateFromMappedRow,
  isPlausibleTradeDateTimeValue,
  parseTradeDate,
  toLocalCalendarDateKey,
} from "@/lib/journal/trade-date-parser"
import {
  buildHeaderMapping,
  detectCsvDelimiter,
  normalizeHeaderKey,
  parseCsvLineWithDelimiter,
  resolveCanonicalHeader,
} from "@/lib/journal/csv-header-utils"

export type JournalCsvColumnDiagnostics = {
  headers: string[]
  firstRowKeys: string[]
  firstRowRaw: Record<string, string>
  headerMapping: Record<string, string>
  detectedTicketHeader: string | null
  detectedDateHeader: string | null
  detectedSymbolHeader: string | null
  detectedTypeHeader: string | null
  detectedProfitHeader: string | null
  detectedCloseTimeHeader: string | null
  detectedOpenTimeHeader: string | null
  inferredTradeDate: string | null
  delimiter: string
}

export function parseCsvProfit(value: string | undefined | null): number {
  if (value == null || String(value).trim() === "") return 0
  const parsed = parseFloat(String(value).replace(/[$,\s]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function sanitizeHeader(header: string): string {
  return header.trim().replace(/^\uFEFF/, "")
}

function detectColumnHeader(
  headers: string[],
  matchers: string[],
): string | null {
  for (const header of headers) {
    const key = normalizeHeaderKey(header)
    if (matchers.some((m) => key === normalizeHeaderKey(m))) {
      return header
    }
  }
  return null
}

function applyDateFromTimeField(row: Mt5CsvRow, value: string) {
  if (!isPlausibleTradeDateTimeValue(value)) return
  const parsed = parseTradeDate(value)
  if (parsed && !row.trade_date?.trim()) {
    row.trade_date = toLocalCalendarDateKey(parsed)
    if (!row.date?.trim()) row.date = row.trade_date
  }
}

export function finalizeJournalCsvRow(row: Mt5CsvRow): Mt5CsvRow {
  if (!row.type?.trim() && row.direction?.trim()) row.type = row.direction
  if (!row.direction?.trim() && row.type?.trim()) row.direction = row.type

  if (!row.symbol?.trim() && row.pair?.trim()) row.symbol = row.pair
  if (!row.pair?.trim() && row.symbol?.trim()) row.pair = row.symbol

  if (!row.trade_date?.trim() && row.date?.trim()) row.trade_date = row.date.trim()

  if (row.close_time?.trim()) applyDateFromTimeField(row, row.close_time)
  if (!row.trade_date?.trim() && row.open_time?.trim()) {
    applyDateFromTimeField(row, row.open_time)
  }

  const datePart = row.trade_date?.trim() || row.date?.trim()
  if (datePart && row.close_time?.trim()) {
    const timeOnly = /^\d{1,2}:\d{2}(?::\d{2})?$/.test(row.close_time.trim())
    if (timeOnly) row.close_time = `${datePart} ${row.close_time.trim()}`
  }

  const pnlRaw = row.pnl?.trim()
  const profitRaw = row.profit?.trim()
  if (pnlRaw) {
    row.pnl = pnlRaw
    if (!profitRaw) row.profit = pnlRaw
  } else if (profitRaw) {
    row.profit = profitRaw
    row.pnl = profitRaw
  }

  return row
}

/**
 * Map CSV row — always assigns values (never skips empty cells for structure).
 */
export function mapCsvTradeRow(headers: string[], values: string[]): Mt5CsvRow {
  const row: Mt5CsvRow = {}
  const usedCanonical = new Set<string>()
  let genericPriceCount = 0

  headers.forEach((rawHeader, index) => {
    const header = sanitizeHeader(rawHeader)
    const value = (values[index] ?? "").trim()
    const normalized = normalizeHeaderKey(header)
    let canonical = resolveCanonicalHeader(header)

    if (normalized === "time") {
      if (!usedCanonical.has("close_time")) canonical = "close_time"
      else if (!usedCanonical.has("open_time")) canonical = "open_time"
    }

    if (canonical === "date") {
      row.date = value
      row.trade_date = value
      usedCanonical.add("date")
      return
    }

    if (canonical === "close_time" || canonical === "open_time") {
      row[canonical] = value
      usedCanonical.add(canonical)
      if (value) applyDateFromTimeField(row, value)
      return
    }

    if (canonical === "pair") {
      row.pair = value
      if (!row.symbol?.trim()) row.symbol = value
      usedCanonical.add("pair")
      return
    }

    if (canonical === "symbol") {
      row.symbol = value
      if (!row.pair?.trim()) row.pair = value
      usedCanonical.add("symbol")
      return
    }

    if (canonical === "direction") {
      row.direction = value
      if (!row.type?.trim()) row.type = value
      usedCanonical.add("direction")
      return
    }

    if (canonical === "type") {
      row.type = value
      if (!row.direction?.trim()) row.direction = value
      usedCanonical.add("type")
      return
    }

    if (canonical === "pnl") {
      row.pnl = value
      usedCanonical.add("pnl")
      return
    }

    if (canonical === "profit") {
      row.profit = value
      usedCanonical.add("profit")
      return
    }

    if (canonical === "price" || normalized === "price") {
      const target = genericPriceCount === 0 ? "open_price" : "close_price"
      genericPriceCount += 1
      row[target] = value
      return
    }

    if (canonical === "ticket") {
      row.ticket = value
      usedCanonical.add("ticket")
      return
    }

    if (canonical && !usedCanonical.has(canonical)) {
      row[canonical] = value
      usedCanonical.add(canonical)
      return
    }

    const rawKey = normalized.replace(/\s+/g, "_")
    if (value || !row[rawKey]) row[rawKey] = value
  })

  return finalizeJournalCsvRow(row)
}

export function buildJournalCsvColumnDiagnostics(
  headers: string[],
  firstRow: Mt5CsvRow | undefined,
  delimiter: string,
): JournalCsvColumnDiagnostics {
  const headerMapping = buildHeaderMapping(headers)
  const firstRowRaw: Record<string, string> = {}
  if (firstRow) {
    for (const [key, value] of Object.entries(firstRow)) {
      if (value != null) firstRowRaw[key] = value
    }
  }

  const inferredTradeDate = firstRow ? inferTradeDateFromMappedRow(firstRow) : null

  return {
    headers,
    firstRowKeys: firstRow ? Object.keys(firstRow) : [],
    firstRowRaw,
    headerMapping,
    detectedTicketHeader: detectColumnHeader(headers, ["ticket", "deal", "position", "order"]),
    detectedDateHeader: detectColumnHeader(headers, [
      "date",
      "trade date",
      "trade_date",
      "day",
    ]),
    detectedCloseTimeHeader: detectColumnHeader(headers, [
      "close time",
      "exit time",
      "close date",
      "closed at",
    ]),
    detectedOpenTimeHeader: detectColumnHeader(headers, [
      "open time",
      "entry time",
      "open date",
    ]),
    detectedSymbolHeader: detectColumnHeader(headers, [
      "symbol",
      "pair",
      "item",
      "instrument",
    ]),
    detectedTypeHeader: detectColumnHeader(headers, ["type", "order type"]),
    detectedProfitHeader:
      detectColumnHeader(headers, ["pnl", "profit", "p l", "pl", "gain"]) ??
      detectColumnHeader(headers, ["pnl"]) ??
      detectColumnHeader(headers, ["profit"]),
    inferredTradeDate,
    delimiter,
  }
}

export function logJournalCsvColumnDiagnostics(diagnostics: JournalCsvColumnDiagnostics): void {
  console.log("[journal-csv-parse] column diagnostics", {
    headers: diagnostics.headers,
    firstRowKeys: diagnostics.firstRowKeys,
    firstRowRaw: diagnostics.firstRowRaw,
    headerMapping: diagnostics.headerMapping,
    detectedTicketHeader: diagnostics.detectedTicketHeader,
    detectedDateHeader: diagnostics.detectedDateHeader,
    detectedCloseTimeHeader: diagnostics.detectedCloseTimeHeader,
    detectedOpenTimeHeader: diagnostics.detectedOpenTimeHeader,
    detectedSymbolHeader: diagnostics.detectedSymbolHeader,
    detectedTypeHeader: diagnostics.detectedTypeHeader,
    detectedProfitHeader: diagnostics.detectedProfitHeader,
    inferredTradeDate: diagnostics.inferredTradeDate,
    delimiter: diagnostics.delimiter,
  })
}

/** @deprecated Use mapCsvTradeRow */
export const mapJournalCsvRow = mapCsvTradeRow
