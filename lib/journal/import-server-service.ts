import type { SupabaseClient } from "@supabase/supabase-js"
import type { NormalizedResearchTrade } from "@/lib/research/types"
import {
  countValidRows,
  filterJournalImportableTrades,
  parseJournalCsvContent,
} from "@/lib/journal/csv-parse-pipeline"
import { logJournalImportRow } from "@/lib/journal/trade-date-parser"
import {
  normalizedToJournalInsert,
  screenshotToJournalInsert,
  type JournalImportPreviewRow,
  type JournalImportResult,
} from "@/lib/journal/csv-import"

export class JournalImportTableMissingError extends Error {
  constructor(message = "Run supabase/012-journal-csv-import.sql in Supabase first.") {
    super(message)
    this.name = "JournalImportTableMissingError"
  }
}

function isMissingColumnError(message: string): boolean {
  return /import_source|external_ticket|journal_csv|does not exist|PGRST205/i.test(message)
}

async function fetchExistingJournalByTicket(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("trades")
    .select("id, external_ticket")
    .eq("user_id", userId)
    .eq("import_source", "journal_csv")
    .not("external_ticket", "is", null)

  if (error) {
    if (isMissingColumnError(error.message)) throw new JournalImportTableMissingError()
    throw new Error(error.message)
  }

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.external_ticket && row.id) {
      map.set(row.external_ticket, row.id)
    }
  }
  return map
}

async function insertJournalTrade(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<string | null> {
  let { error } = await supabase.from("trades").insert([payload])

  if (error && /column|schema cache/i.test(error.message)) {
    const {
      import_source,
      external_ticket,
      opened_at,
      closed_at,
      lots,
      commission,
      swap,
      raw_payload,
      research_strategy_id,
      setup_score,
      setup_classification,
      setup_score_breakdown,
      setup_coaching_insights,
      ...core
    } = payload
    ;({ error } = await supabase.from("trades").insert([core]))
  }

  if (error) {
    if (isMissingColumnError(error.message)) throw new JournalImportTableMissingError()
    return error.message
  }

  return null
}

async function replaceJournalTradeById(
  supabase: SupabaseClient,
  tradeId: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const { user_id, ...updatePayload } = payload
  void user_id

  let { error } = await supabase.from("trades").update(updatePayload).eq("id", tradeId)

  if (error && /column|schema cache/i.test(error.message)) {
    const {
      import_source,
      external_ticket,
      opened_at,
      closed_at,
      lots,
      commission,
      swap,
      raw_payload,
      research_strategy_id,
      setup_score,
      setup_classification,
      setup_score_breakdown,
      setup_coaching_insights,
      ...core
    } = updatePayload
    ;({ error } = await supabase.from("trades").update(core).eq("id", tradeId))
  }

  if (error) {
    if (isMissingColumnError(error.message)) throw new JournalImportTableMissingError()
    return error.message
  }

  return null
}

function buildSummaryMessage(total: number, ready: number, skipped: number, needsDateFix: number) {
  const parts = [`Found ${total} rows`, `import-ready ${ready}`, `skipped ${skipped}`]
  if (needsDateFix > 0) parts.push(`${needsDateFix} need date fix`)
  return parts.join(", ")
}

function emptyImportResult(dryRun: boolean, errors: string[]): JournalImportResult {
  return {
    dryRun,
    preview: [],
    dateLogs: [],
    importedCount: 0,
    replacedCount: 0,
    skippedCount: 0,
    errorCount: errors.length,
    errors,
    totalRowsFound: 0,
    importReadyCount: 0,
    needsDateFixCount: 0,
    summaryMessage: buildSummaryMessage(0, 0, 0, 0),
  }
}

function resultFromPipeline(
  dryRun: boolean,
  pipeline: ReturnType<typeof parseJournalCsvContent>,
  extra?: Partial<JournalImportResult>,
): JournalImportResult {
  const importReadyCount = pipeline.validRowCount
  const skippedCount = pipeline.preview.filter(
    (row) => row.status === "duplicate" || row.status === "error",
  ).length

  return {
    dryRun,
    preview: pipeline.preview,
    dateLogs: pipeline.dateLogs,
    importedCount: importReadyCount,
    replacedCount: pipeline.preview.filter((row) => row.status === "replace").length,
    skippedCount,
    errorCount: pipeline.debug.errorCount,
    errors: pipeline.parseErrors,
    totalRowsFound: pipeline.debug.rawRowCount,
    importReadyCount,
    validRowCount: importReadyCount,
    needsDateFixCount: pipeline.debug.needsDateFixCount,
    summaryMessage: pipeline.summaryMessage,
    parseDebug: pipeline.debug,
    columnDiagnostics: pipeline.debug.columnDiagnostics,
    calendarSummary: pipeline.calendarSummary,
    ...extra,
  }
}

function buildScreenshotPreview(screenshotUrls: string[]): JournalImportPreviewRow[] {
  const today = new Date().toISOString().slice(0, 10)
  return screenshotUrls.map((url, index) => ({
    rowNumber: index + 1,
    external_ticket: `screenshot-${index + 1}`,
    pair: "Chart import",
    direction: "BUY",
    result: "BE",
    pnl: 0,
    session: null,
    risk_reward: null,
    trade_date: today,
    status: "ready" as const,
    message: "Screenshot journal entry — edit details after import.",
    suggested_emotion: "Calm",
    suggested_setup: "B Setup",
    suggested_mistake_tags: ["Screenshot import"],
    screenshot_url: url,
  }))
}

export async function importJournalUpload(
  supabase: SupabaseClient,
  userId: string,
  options: {
    csvContent?: string | null
    screenshotUrls?: string[]
    dryRun: boolean
    maxRiskPerTrade?: number
    replaceExisting?: boolean
    /** YYYY-MM-DD for rows with no Date / Close Time / Open Time in CSV */
    fallbackDateForMissing?: string
  },
): Promise<JournalImportResult> {
  const screenshotUrls = options.screenshotUrls ?? []
  const maxRisk = options.maxRiskPerTrade ?? 1
  const replaceExisting = options.replaceExisting ?? false

  if (!options.csvContent?.trim() && screenshotUrls.length === 0) {
    return emptyImportResult(options.dryRun, [
      "Upload a CSV file and/or at least one chart screenshot.",
    ])
  }

  if (!options.csvContent?.trim()) {
    const preview = buildScreenshotPreview(screenshotUrls)
    if (options.dryRun) {
      return {
        dryRun: true,
        preview,
        dateLogs: [],
        importedCount: preview.length,
        replacedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
        totalRowsFound: preview.length,
        importReadyCount: preview.length,
        needsDateFixCount: 0,
        summaryMessage: buildSummaryMessage(preview.length, preview.length, 0, 0),
      }
    }

    const insertErrors: string[] = []
    let importedCount = 0
    for (let i = 0; i < screenshotUrls.length; i += 1) {
      const payload = screenshotToJournalInsert(userId, screenshotUrls[i], i, maxRisk)
      const err = await insertJournalTrade(supabase, payload)
      if (err) insertErrors.push(err)
      else importedCount += 1
    }

    return {
      dryRun: false,
      preview,
      dateLogs: [],
      importedCount,
      replacedCount: 0,
      skippedCount: 0,
      errorCount: insertErrors.length,
      errors: insertErrors,
      totalRowsFound: preview.length,
      importReadyCount: importedCount,
      needsDateFixCount: 0,
      summaryMessage: buildSummaryMessage(preview.length, importedCount, 0, 0),
    }
  }

  const existingByTicket = await fetchExistingJournalByTicket(supabase, userId)
  const existingTickets = new Set(existingByTicket.keys())

  const pipeline = parseJournalCsvContent(options.csvContent, {
    existingTickets,
    replaceExisting,
    screenshotUrls,
    fallbackDateForMissing: options.fallbackDateForMissing,
  })

  for (const log of pipeline.dateLogs) {
    console.log("[journal-import-date]", log)
  }

  if (pipeline.preview.length === 0) {
    return emptyImportResult(
      options.dryRun,
      pipeline.parseErrors.length ? pipeline.parseErrors : ["No trade rows found in CSV."],
    )
  }

  const importable = filterJournalImportableTrades(
    pipeline.trades,
    existingTickets,
    replaceExisting,
  )

  if (options.dryRun) {
    return resultFromPipeline(true, pipeline)
  }

  let importedCount = 0
  let replacedCount = 0
  const insertErrors: string[] = [...pipeline.parseErrors]
  let screenshotIndex = 0

  for (const trade of importable) {
    const screenshotUrl = screenshotUrls[screenshotIndex] ?? null
    if (screenshotUrl) screenshotIndex += 1

    const payload = normalizedToJournalInsert(trade, userId, maxRisk, screenshotUrl)
    const existingId = existingByTicket.get(trade.external_ticket)
    const duplicateFound = Boolean(existingId)

    if (existingId && replaceExisting) {
      const err = await replaceJournalTradeById(supabase, existingId, payload)
      logJournalImportRow({
        ticket: trade.external_ticket,
        rawDateValue: trade.trade_date,
        parsedTradeDate: trade.trade_date,
        tradeTime: trade.closed_at?.split("T")[1] ?? null,
        duplicateFound: true,
        action: err ? "rejected" : "replace",
      })
      if (err) insertErrors.push(`Ticket ${trade.external_ticket}: ${err}`)
      else replacedCount += 1
    } else if (!existingId) {
      const err = await insertJournalTrade(supabase, payload)
      logJournalImportRow({
        ticket: trade.external_ticket,
        rawDateValue: trade.trade_date,
        parsedTradeDate: trade.trade_date,
        tradeTime: trade.closed_at?.split("T")[1] ?? null,
        duplicateFound: false,
        action: err ? "rejected" : "insert",
      })
      if (err) insertErrors.push(`Ticket ${trade.external_ticket}: ${err}`)
      else importedCount += 1
    } else {
      logJournalImportRow({
        ticket: trade.external_ticket,
        rawDateValue: trade.trade_date,
        parsedTradeDate: trade.trade_date,
        tradeTime: null,
        duplicateFound: true,
        action: "skipped_duplicate",
      })
    }
  }

  for (let i = screenshotIndex; i < screenshotUrls.length; i += 1) {
    const payload = screenshotToJournalInsert(userId, screenshotUrls[i], i, maxRisk)
    const err = await insertJournalTrade(supabase, payload)
    if (err) insertErrors.push(`Screenshot ${i + 1}: ${err}`)
    else importedCount += 1
  }

  return resultFromPipeline(false, pipeline, {
    importedCount,
    replacedCount,
    errorCount: insertErrors.length,
    errors: insertErrors,
  })
}

export type DeleteJournalCsvImportsResult = {
  deletedCount: number
}

export async function deleteAllJournalCsvImports(
  supabase: SupabaseClient,
  userId: string,
  options?: { tradeDate?: string },
): Promise<DeleteJournalCsvImportsResult> {
  let query = supabase
    .from("trades")
    .select("id")
    .eq("user_id", userId)
    .eq("import_source", "journal_csv")

  if (options?.tradeDate) {
    query = query.eq("trade_date", options.tradeDate)
  }

  const { data: rows, error: selectError } = await query

  if (selectError) {
    if (isMissingColumnError(selectError.message)) throw new JournalImportTableMissingError()
    throw new Error(selectError.message)
  }

  const ids = (rows ?? []).map((row) => row.id).filter(Boolean)
  if (ids.length === 0) return { deletedCount: 0 }

  let deleteQuery = supabase
    .from("trades")
    .delete()
    .eq("user_id", userId)
    .eq("import_source", "journal_csv")

  if (options?.tradeDate) {
    deleteQuery = deleteQuery.eq("trade_date", options.tradeDate)
  }

  const { error: deleteError } = await deleteQuery

  if (deleteError) {
    if (isMissingColumnError(deleteError.message)) throw new JournalImportTableMissingError()
    throw new Error(deleteError.message)
  }

  console.log("[journal-import] deleted journal_csv trades", {
    deletedCount: ids.length,
    tradeDate: options?.tradeDate ?? "all",
  })
  return { deletedCount: ids.length }
}

/** @deprecated Use importJournalUpload */
export const importJournalCsv = importJournalUpload
