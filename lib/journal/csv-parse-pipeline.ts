import { parseMt5Csv } from "@/lib/research/mt5-csv-parser"
import { dedupeWithinBatch, filterImportableTrades } from "@/lib/research/dedupe"
import type { NormalizedResearchTrade } from "@/lib/research/types"
import {
  buildJournalCalendarSummary,
  buildJournalDateLogs,
  suggestJournalTags,
  type JournalImportDateLog,
  type JournalImportPreviewRow,
} from "@/lib/journal/csv-import"
import type { JournalCsvColumnDiagnostics } from "@/lib/journal/journal-csv-mapper"
import { buildHeaderMapping } from "@/lib/journal/csv-header-utils"
import { inferTradeDateFromMappedRow, logJournalImportRow } from "@/lib/journal/trade-date-parser"
import type { Mt5CsvRow } from "@/lib/research/types"
import {
  normalizeMt5CsvRowSoft,
  type NormalizeCsvRowResult,
} from "@/lib/research/trade-normalizer"

export type JournalCsvParseDebug = {
  headers: string[]
  headerMapping: Record<string, string>
  delimiter: string
  rawRowCount: number
  parsedRowCount: number
  validRowCount: number
  needsDateFixCount: number
  errorCount: number
  skippedDuplicateCount: number
  rejections: Array<{ rowNumber: number; ticket?: string; reason: string }>
  columnDiagnostics?: JournalCsvColumnDiagnostics
}

export type JournalCsvParseResult = {
  trades: NormalizedResearchTrade[]
  preview: JournalImportPreviewRow[]
  dateLogs: JournalImportDateLog[]
  calendarSummary?: ReturnType<typeof buildJournalCalendarSummary>
  debug: JournalCsvParseDebug
  parseErrors: string[]
  summaryMessage: string
  validRowCount: number
}

function logJournalCsvParse(message: string, payload?: Record<string, unknown>) {
  console.log("[journal-csv-parse]", message, payload ?? "")
}

function resolvePreviewStatus(
  outcome: NormalizeCsvRowResult,
  batchDupes: Set<string>,
  existingTickets: Set<string>,
  replaceExisting: boolean,
): { status: JournalImportPreviewRow["status"]; message?: string; duplicateFound: boolean } {
  if (outcome.status === "error") {
    return { status: "error", message: outcome.message, duplicateFound: false }
  }

  if (outcome.status === "needs_date_fix") {
    return {
      status: "needs_date_fix",
      message: outcome.message,
      duplicateFound: false,
    }
  }

  const ticket = outcome.trade.external_ticket

  if (batchDupes.has(ticket)) {
    return {
      status: "error",
      message: "Duplicate ticket within this CSV batch.",
      duplicateFound: true,
    }
  }

  if (existingTickets.has(ticket)) {
    if (replaceExisting) {
      return {
        status: "replace",
        message: "Will replace existing trade by ticket.",
        duplicateFound: true,
      }
    }
    return {
      status: "duplicate",
      message: "Skipped duplicate.",
      duplicateFound: true,
    }
  }

  return { status: "ready", duplicateFound: false }
}

function applyFallbackDateToRows(
  rows: Mt5CsvRow[],
  fallbackDate: string,
): Mt5CsvRow[] {
  return rows.map((row) => {
    if (inferTradeDateFromMappedRow(row)) return row
    return { ...row, trade_date: fallbackDate, date: fallbackDate }
  })
}

export function parseJournalCsvContent(
  csvContent: string,
  options?: {
    existingTickets?: Set<string>
    replaceExisting?: boolean
    screenshotUrls?: string[]
    /** YYYY-MM-DD applied when CSV has no Date / Close Time / Open Time */
    fallbackDateForMissing?: string
  },
): JournalCsvParseResult {
  const parsed = parseMt5Csv(csvContent)
  const headerMapping = parsed.headerMapping ?? buildHeaderMapping(parsed.headers)
  const columnDiagnostics = parsed.columnDiagnostics
  const rawRowCount = parsed.rows.length

  if (columnDiagnostics) {
    logJournalCsvParse("column diagnostics", columnDiagnostics)
  }

  logJournalCsvParse("headers detected", {
    headers: parsed.headers,
    headerMapping,
    delimiter: parsed.delimiter ?? ",",
    firstRowKeys: columnDiagnostics?.firstRowKeys,
    firstRowRaw: columnDiagnostics?.firstRowRaw,
    detectedDateHeader: columnDiagnostics?.detectedDateHeader,
    detectedProfitHeader: columnDiagnostics?.detectedProfitHeader,
  })
  logJournalCsvParse("total CSV rows", { totalCsvRows: rawRowCount })

  const outcomes: NormalizeCsvRowResult[] = []
  const rejections: JournalCsvParseDebug["rejections"] = []

  const rowsToParse = options?.fallbackDateForMissing
    ? applyFallbackDateToRows(parsed.rows, options.fallbackDateForMissing)
    : parsed.rows

  rowsToParse.forEach((row, index) => {
    const rowNumber = index + 2
    const outcome = normalizeMt5CsvRowSoft(row, rowNumber)
    outcomes.push(outcome)

    if (outcome.status === "error") {
      rejections.push({ rowNumber, ticket: outcome.ticket, reason: outcome.message })
      logJournalImportRow({
        rowNumber,
        ticket: outcome.ticket,
        rawDateValue: row.date ?? "",
        parsedTradeDate: "",
        tradeTime: null,
        duplicateFound: false,
        action: "rejected",
      })
    } else if (outcome.status === "needs_date_fix") {
      rejections.push({
        rowNumber,
        ticket: outcome.ticket,
        reason: outcome.message,
      })
      logJournalImportRow({
        rowNumber,
        ticket: outcome.ticket,
        rawDateValue: outcome.rawDateValue ?? row.date ?? "",
        parsedTradeDate: "",
        tradeTime: null,
        duplicateFound: false,
        action: "preview_needs_date",
      })
    } else {
      logJournalImportRow({
        rowNumber,
        ticket: outcome.trade.external_ticket,
        rawDateValue: outcome.trade.trade_date,
        parsedTradeDate: outcome.trade.trade_date,
        tradeTime: outcome.trade.closed_at?.split("T")[1] ?? null,
        duplicateFound: false,
        action: "preview_ready",
      })
    }
  })

  const importableTrades = outcomes
    .filter((o): o is Extract<NormalizeCsvRowResult, { status: "ok" }> => o.status === "ok")
    .map((o) => o.trade)

  const validRowCount = importableTrades.length
  const needsDateFixCount = outcomes.filter((o) => o.status === "needs_date_fix").length
  const errorCount = outcomes.filter((o) => o.status === "error").length

  logJournalCsvParse("row counts after parsing", {
    parsedRowCount: outcomes.length,
    validRows: validRowCount,
    needsDateFixCount,
    errorCount,
  })

  const existingTickets = options?.existingTickets ?? new Set<string>()
  const { unique, duplicatesInBatch } = dedupeWithinBatch(importableTrades)
  const batchDupes = new Set(duplicatesInBatch)
  const replaceExisting = options?.replaceExisting ?? false

  let screenshotIndex = 0
  const screenshotUrls = options?.screenshotUrls ?? []

  const preview: JournalImportPreviewRow[] = outcomes.map((outcome) => {
    if (outcome.status === "error") {
      return {
        rowNumber: outcome.rowNumber,
        external_ticket: outcome.ticket ?? `row-${outcome.rowNumber}`,
        pair: outcome.pair ?? "—",
        direction: outcome.direction ?? "—",
        result: "BE",
        pnl: outcome.pnl ?? 0,
        session: null,
        risk_reward: null,
        trade_date: "",
        status: "error",
        message: outcome.message,
      }
    }

    if (outcome.status === "needs_date_fix") {
      const previewPnl = outcome.pnl ?? 0
      const previewResult =
        previewPnl > 0 ? "WIN" : previewPnl < 0 ? "LOSS" : "BE"
      return {
        rowNumber: outcome.rowNumber,
        external_ticket: outcome.ticket ?? `row-${outcome.rowNumber}`,
        pair: outcome.pair ?? "—",
        direction: outcome.direction ?? "—",
        result: previewResult,
        pnl: previewPnl,
        session: null,
        risk_reward: null,
        trade_date: outcome.rawDateValue ?? "",
        status: "needs_date_fix",
        message: outcome.message,
      }
    }

    const trade = outcome.trade
    const { status, message, duplicateFound } = resolvePreviewStatus(
      outcome,
      batchDupes,
      existingTickets,
      replaceExisting,
    )

    logJournalImportRow({
      rowNumber: outcome.rowNumber,
      ticket: trade.external_ticket,
      rawDateValue: trade.trade_date,
      parsedTradeDate: trade.trade_date,
      tradeTime: trade.closed_at?.includes("T") ? trade.closed_at.split("T")[1] : null,
      duplicateFound,
      action:
        status === "replace"
          ? "replace"
          : status === "duplicate"
            ? "skipped_duplicate"
            : "preview_ready",
    })

    const suggestions = suggestJournalTags(trade)
    const willImport = status === "ready" || status === "replace"
    const screenshot_url =
      willImport && screenshotUrls[screenshotIndex]
        ? screenshotUrls[screenshotIndex++]
        : null

    return {
      rowNumber: outcome.rowNumber,
      external_ticket: trade.external_ticket,
      pair: trade.pair,
      direction: trade.direction,
      result: trade.result,
      pnl: trade.pnl,
      session: trade.session,
      risk_reward: trade.risk_reward,
      trade_date: trade.trade_date,
      status,
      message,
      suggested_emotion: suggestions.emotion,
      suggested_setup: suggestions.setup,
      suggested_mistake_tags: suggestions.mistake_tags,
      screenshot_url,
    }
  })

  const importReadyCount = countValidRows(preview)
  const skippedDuplicateCount = preview.filter((row) => row.status === "duplicate").length
  const skippedCount = preview.filter(
    (row) => row.status === "duplicate" || row.status === "error",
  ).length

  logJournalCsvParse("import summary", {
    totalCsvRows: rawRowCount,
    validRows: importReadyCount,
    skippedRows: skippedCount,
    needsDateFixCount,
  })

  const dateLogs = buildJournalDateLogs(unique)
  const calendarSummary =
    unique.length > 0 ? buildJournalCalendarSummary(unique) : undefined

  const debug: JournalCsvParseDebug = {
    headers: parsed.headers,
    headerMapping: parsed.headerMapping ?? headerMapping,
    delimiter: parsed.delimiter ?? ",",
    rawRowCount,
    parsedRowCount: outcomes.length,
    validRowCount: importReadyCount,
    needsDateFixCount,
    errorCount,
    skippedDuplicateCount,
    rejections,
    columnDiagnostics,
  }

  return {
    trades: unique,
    preview,
    dateLogs,
    calendarSummary,
    debug,
    parseErrors: rejections.map((r) => `Row ${r.rowNumber}: ${r.reason}`),
    validRowCount: importReadyCount,
    summaryMessage: `Found ${rawRowCount} rows, import-ready ${importReadyCount}, skipped ${skippedCount}${
      needsDateFixCount > 0 ? `, ${needsDateFixCount} need date fix` : ""
    }`,
  }
}

/** Rows that will be inserted or replaced on import. */
export function countValidRows(preview: JournalImportPreviewRow[]): number {
  return preview.filter((row) => row.status === "ready" || row.status === "replace").length
}

/** @deprecated Use countValidRows */
export const countImportReadyRows = countValidRows

export function filterJournalImportableTrades(
  trades: NormalizedResearchTrade[],
  existingTickets: Set<string>,
  replaceExisting: boolean,
): NormalizedResearchTrade[] {
  return filterImportableTrades(trades, existingTickets, { replaceExisting })
}
