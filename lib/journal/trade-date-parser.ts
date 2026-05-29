/**
 * Journal CSV trade date parsing — groups trades by local YYYY-MM-DD.
 * Date-only rows (e.g. 2026-05-28) are valid; time is optional.
 */

export type TradeDateCsvRow = Record<string, string | undefined | null>

const DATE_ONLY_KEYS = ["trade_date", "date", "trade date", "day", "trading date"] as const

const CLOSE_TIME_KEYS = [
  "close_time",
  "closetime",
  "close time",
  "exit_time",
  "exittime",
  "exit time",
] as const

const OPEN_TIME_KEYS = [
  "open_time",
  "opentime",
  "open time",
  "entry_time",
  "entrytime",
  "entry time",
] as const

const CLOSE_DATE_ONLY_KEYS = ["close date", "close_date", "closedate"] as const
const CLOSE_TIME_ONLY_KEYS = ["close time", "close_time", "closetime", "exit time", "exit_time"] as const
const OPEN_DATE_ONLY_KEYS = ["open date", "open_date", "opendate"] as const
const OPEN_TIME_ONLY_KEYS = ["open time", "open_time", "opentime", "entry time", "entry_time"] as const

function normalizeRowKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, " ")
}

function sanitizeDateInput(value: string): string {
  return value.replace(/^\uFEFF/, "").trim()
}

export function pickRowValue(row: TradeDateCsvRow, keys: readonly string[]): string | null {
  for (const key of keys) {
    const direct = row[key]
    if (direct?.trim()) return sanitizeDateInput(direct)
  }

  for (const [rawKey, value] of Object.entries(row)) {
    if (!value?.trim()) continue
    const normalized = normalizeRowKey(rawKey)
    if (keys.some((k) => normalized === normalizeRowKey(k))) {
      return sanitizeDateInput(value)
    }
  }

  return null
}

function combineDateAndTime(datePart: string, timePart: string | null): string {
  if (!timePart?.trim()) return datePart
  return `${datePart} ${timePart.trim()}`
}

export function isIsoDateOnlyString(value: string): boolean {
  const v = sanitizeDateInput(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(v)
}

export function isDateOnlyValue(value: string): boolean {
  const v = sanitizeDateInput(value)
  return (
    isIsoDateOnlyString(v) ||
    /^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}$/.test(v)
  )
}

function isTimeOnlyValue(value: string): boolean {
  return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(sanitizeDateInput(value))
}

function parseDateParts(value: string): Date | null {
  const trimmed = sanitizeDateInput(value)

  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (isoDateOnly) {
    const local = new Date(
      Number(isoDateOnly[1]),
      Number(isoDateOnly[2]) - 1,
      Number(isoDateOnly[3]),
      0,
      0,
      0,
    )
    return Number.isNaN(local.getTime()) ? null : local
  }

  const mt5 =
    /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      trimmed.replace(/\s+/g, " "),
    )
  if (mt5) {
    const year = Number(mt5[1])
    const month = Number(mt5[2]) - 1
    const day = Number(mt5[3])
    const hour = Number(mt5[4] ?? 0)
    const minute = Number(mt5[5] ?? 0)
    const second = Number(mt5[6] ?? 0)
    const local = new Date(year, month, day, hour, minute, second)
    return Number.isNaN(local.getTime()) ? null : local
  }

  const us =
    /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      trimmed,
    )
  if (us) {
    let year = Number(us[3])
    if (year < 100) year += 2000
    const month = Number(us[1]) - 1
    const day = Number(us[2])
    const hour = Number(us[4] ?? 0)
    const minute = Number(us[5] ?? 0)
    const second = Number(us[6] ?? 0)
    const local = new Date(year, month, day, hour, minute, second)
    return Number.isNaN(local.getTime()) ? null : local
  }

  // Avoid treating prices (1.12) or P&L (-94.05) as dates via Date() heuristics.
  if (!/(19|20)\d{2}/.test(trimmed)) return null

  const normalized = trimmed.replace(/\./g, "-")
  const fallback = new Date(normalized)
  if (!Number.isNaN(fallback.getTime())) return fallback

  return null
}

/** True when a cell value is plausibly a trade date/time (not a price or P&L). */
export function isPlausibleTradeDateTimeValue(value: string | undefined | null): boolean {
  if (!value?.trim()) return false
  const trimmed = sanitizeDateInput(value)

  if (isIsoDateOnlyString(trimmed)) return true
  if (isDateOnlyValue(trimmed)) return true
  if (isTimeOnlyValue(trimmed)) return true

  if (/^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(trimmed)) return true
  if (/^\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4}/.test(trimmed)) return true
  if (/(\d{4}-\d{2}-\d{2})/.test(trimmed)) return true

  if (/^-?\d+(\.\d+)?$/.test(trimmed.replace(/[$,\s]/g, ""))) return false

  return /(19|20)\d{2}/.test(trimmed)
}

export function parseTradeDate(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null
  return parseDateParts(sanitizeDateInput(raw))
}

export function toLocalCalendarDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function toLocalIsoDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${toLocalCalendarDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function extractTradeTime(isoDateTime: string | null): string | null {
  if (!isoDateTime) return null
  const match = /T(\d{2}:\d{2}:\d{2})/.exec(isoDateTime)
  if (!match) return null
  return match[1] === "00:00:00" ? null : match[1]
}

export type ParsedTradeDateResult = {
  rawDateTime: string
  rawDateValue: string
  parsedDate: Date
  calendarDateKey: string
  isoDateTime: string | null
  tradeTime: string | null
  dateOnly: boolean
}

/**
 * Prefer explicit Date column, then Close/Open/Time columns.
 */
export function getRawTradeDateTime(row: TradeDateCsvRow): string | null {
  const dateColumn = pickRowValue(row, DATE_ONLY_KEYS)
  if (dateColumn) {
    const timePart =
      pickRowValue(row, ["time"]) ??
      pickRowValue(row, CLOSE_TIME_ONLY_KEYS) ??
      pickRowValue(row, OPEN_TIME_ONLY_KEYS)
    if (isDateOnlyValue(dateColumn)) {
      return combineDateAndTime(
        dateColumn,
        timePart && isTimeOnlyValue(timePart) ? timePart : null,
      )
    }
    const parsed = parseTradeDate(dateColumn)
    if (parsed) return toLocalIsoDateTime(parsed)
  }

  const closeCandidate = pickRowValue(row, CLOSE_TIME_KEYS)
  const closeDateOnly = pickRowValue(row, CLOSE_DATE_ONLY_KEYS)
  const closeTimeOnly = pickRowValue(row, CLOSE_TIME_ONLY_KEYS)

  if (closeCandidate) {
    if (isDateOnlyValue(closeCandidate)) {
      return combineDateAndTime(
        closeCandidate,
        closeTimeOnly && isTimeOnlyValue(closeTimeOnly) ? closeTimeOnly : null,
      )
    }
    if (!isTimeOnlyValue(closeCandidate)) return closeCandidate
  }

  const combinedClose = combineDateAndTime(
    closeDateOnly ?? "",
    closeTimeOnly && isTimeOnlyValue(closeTimeOnly) ? closeTimeOnly : null,
  )
  if (closeDateOnly && combinedClose) return combinedClose

  const openCandidate = pickRowValue(row, OPEN_TIME_KEYS)
  const openDateOnly = pickRowValue(row, OPEN_DATE_ONLY_KEYS)
  const openTimeOnly = pickRowValue(row, OPEN_TIME_ONLY_KEYS)

  if (openCandidate) {
    if (isDateOnlyValue(openCandidate)) {
      return combineDateAndTime(
        openCandidate,
        openTimeOnly && isTimeOnlyValue(openTimeOnly) ? openTimeOnly : null,
      )
    }
    if (!isTimeOnlyValue(openCandidate)) return openCandidate
  }

  if (openDateOnly) {
    return combineDateAndTime(
      openDateOnly,
      openTimeOnly && isTimeOnlyValue(openTimeOnly) ? openTimeOnly : null,
    )
  }

  const genericTime = pickRowValue(row, ["time"])
  if (genericTime) return genericTime

  return dateColumn
}

export function getTradeDate(row: TradeDateCsvRow): string | null {
  return getRawTradeDateTime(row)
}

/** Infer calendar date from explicit date/time columns only (never prices or P&L). */
export function inferTradeDateFromMappedRow(row: TradeDateCsvRow): string | null {
  const priorityKeys = [
    "trade_date",
    "date",
    "close_time",
    "open_time",
    "time",
    "close_date",
    "open_date",
  ]

  for (const key of priorityKeys) {
    const value = row[key]?.trim()
    if (!value || !isPlausibleTradeDateTimeValue(value)) continue
    const parsed = parseTradeDate(value)
    if (parsed) return toLocalCalendarDateKey(parsed)
  }

  return null
}

export function resolveTradeDateFromRow(row: TradeDateCsvRow): ParsedTradeDateResult | null {
  const inferred = inferTradeDateFromMappedRow(row)
  if (inferred) {
    return {
      rawDateTime: inferred,
      rawDateValue: inferred,
      parsedDate: parseTradeDate(inferred)!,
      calendarDateKey: inferred,
      isoDateTime: null,
      tradeTime: null,
      dateOnly: true,
    }
  }

  const directTradeDate = row.trade_date?.trim() || pickRowValue(row, DATE_ONLY_KEYS)
  if (directTradeDate && isIsoDateOnlyString(directTradeDate)) {
    const parsedDate = parseTradeDate(directTradeDate)
    if (!parsedDate) return null
    return {
      rawDateTime: directTradeDate,
      rawDateValue: sanitizeDateInput(directTradeDate),
      parsedDate,
      calendarDateKey: toLocalCalendarDateKey(parsedDate),
      isoDateTime: null,
      tradeTime: null,
      dateOnly: true,
    }
  }

  const rawDateValue = directTradeDate ?? getRawTradeDateTime(row)
  if (!rawDateValue) return null

  const rawDateTime = getRawTradeDateTime(row) ?? rawDateValue
  const parsedDate = parseTradeDate(rawDateTime) ?? parseTradeDate(rawDateValue)
  if (!parsedDate) return null

  const dateOnly =
    isIsoDateOnlyString(rawDateValue) ||
    isDateOnlyString(rawDateTime) ||
    (isDateOnlyValue(rawDateValue) && !/\d{1,2}:\d{2}/.test(rawDateTime))

  const isoDateTime = dateOnly ? null : toLocalIsoDateTime(parsedDate)

  return {
    rawDateTime,
    rawDateValue: sanitizeDateInput(rawDateValue),
    parsedDate,
    calendarDateKey: toLocalCalendarDateKey(parsedDate),
    isoDateTime,
    tradeTime: isoDateTime ? extractTradeTime(isoDateTime) : null,
    dateOnly,
  }
}

function isDateOnlyString(value: string): boolean {
  return isDateOnlyValue(value) && !/\d{1,2}:\d{2}/.test(value)
}

/** Calendar grouping: trade_date column only (never created_at). */
export function getCalendarDateKey(trade: {
  trade_date?: string | null
  created_at?: string | null
}): string | null {
  if (!trade.trade_date?.trim()) return null

  const raw = sanitizeDateInput(trade.trade_date)
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(raw)
  if (iso) return iso[1]

  const parsed = parseTradeDate(raw)
  return parsed ? toLocalCalendarDateKey(parsed) : null
}

export type JournalImportRowDateLog = {
  rowNumber?: number
  ticket?: string
  rawDateValue: string
  parsedTradeDate: string
  tradeTime: string | null
  duplicateFound: boolean
  action: "insert" | "replace" | "skipped_duplicate" | "rejected" | "preview_ready" | "preview_needs_date"
}

export function logJournalImportRow(payload: JournalImportRowDateLog): void {
  console.log("[journal-import]", payload)
}

export function logJournalImportDateDebug(payload: {
  rowNumber?: number
  ticket?: string
  originalCsvDateTime: string
  parsedDate: string
  groupedCalendarDate: string
  tradeProfit: number
  tradeTime?: string | null
}): void {
  logJournalImportRow({
    rowNumber: payload.rowNumber,
    ticket: payload.ticket,
    rawDateValue: payload.originalCsvDateTime,
    parsedTradeDate: payload.groupedCalendarDate,
    tradeTime: payload.tradeTime ?? null,
    duplicateFound: false,
    action: "preview_ready",
  })
}
