import type { SupabaseClient } from "@supabase/supabase-js"
import { parseMt5Csv } from "@/lib/research/mt5-csv-parser"
import { normalizeMt5CsvRow } from "@/lib/research/trade-normalizer"
import {
  buildImportPreview,
  dedupeWithinBatch,
  filterImportableTrades,
} from "@/lib/research/dedupe"
import type { NormalizedResearchTrade } from "@/lib/research/types"
import {
  normalizedToJournalInsert,
  screenshotToJournalInsert,
  suggestJournalTags,
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

async function fetchExistingJournalTickets(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("trades")
    .select("external_ticket")
    .eq("user_id", userId)
    .eq("import_source", "journal_csv")
    .not("external_ticket", "is", null)

  if (error) {
    if (isMissingColumnError(error.message)) throw new JournalImportTableMissingError()
    throw new Error(error.message)
  }

  return new Set(
    (data ?? [])
      .map((row) => row.external_ticket)
      .filter((ticket): ticket is string => Boolean(ticket)),
  )
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

function toJournalPreview(
  researchPreview: ReturnType<typeof buildImportPreview>,
  normalized: NormalizedResearchTrade[],
  screenshotUrls: string[],
): JournalImportPreviewRow[] {
  const byTicket = new Map(normalized.map((t) => [t.external_ticket, t]))
  let screenshotIndex = 0

  return researchPreview.map((row) => {
    const trade = byTicket.get(row.external_ticket)
    const suggestions = trade ? suggestJournalTags(trade) : null
    const screenshot_url =
      row.status === "ready" && screenshotUrls[screenshotIndex]
        ? screenshotUrls[screenshotIndex++]
        : null

    return {
      rowNumber: row.rowNumber,
      external_ticket: row.external_ticket,
      pair: row.pair,
      direction: row.direction,
      result: row.result,
      pnl: row.pnl,
      session: trade?.session ?? null,
      risk_reward: trade?.risk_reward ?? null,
      trade_date: trade?.trade_date ?? "",
      status: row.status === "invalid" ? "error" : row.status,
      message: row.message,
      suggested_emotion: suggestions?.emotion,
      suggested_setup: suggestions?.setup,
      suggested_mistake_tags: suggestions?.mistake_tags,
      screenshot_url,
    }
  })
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
  },
): Promise<JournalImportResult> {
  const screenshotUrls = options.screenshotUrls ?? []
  const maxRisk = options.maxRiskPerTrade ?? 1

  if (!options.csvContent?.trim() && screenshotUrls.length === 0) {
    return {
      dryRun: options.dryRun,
      preview: [],
      importedCount: 0,
      skippedCount: 0,
      errorCount: 1,
      errors: ["Upload a CSV file and/or at least one chart screenshot."],
    }
  }

  if (!options.csvContent?.trim()) {
    const preview = buildScreenshotPreview(screenshotUrls)
    if (options.dryRun) {
      return {
        dryRun: true,
        preview,
        importedCount: preview.length,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
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
      importedCount,
      skippedCount: 0,
      errorCount: insertErrors.length,
      errors: insertErrors,
    }
  }

  const parsed = parseMt5Csv(options.csvContent)
  const normalized: NormalizedResearchTrade[] = []
  const parseErrors: string[] = []

  parsed.rows.forEach((row, index) => {
    try {
      normalized.push(normalizeMt5CsvRow(row, index + 2))
    } catch (error) {
      parseErrors.push(
        error instanceof Error ? error.message : `Row ${index + 2}: invalid trade row`,
      )
    }
  })

  if (normalized.length === 0) {
    return {
      dryRun: options.dryRun,
      preview: [],
      importedCount: 0,
      skippedCount: 0,
      errorCount: parseErrors.length || 1,
      errors: parseErrors.length ? parseErrors : ["No valid trade rows found in CSV."],
    }
  }

  const existingTickets = await fetchExistingJournalTickets(supabase, userId)
  const { unique, duplicatesInBatch } = dedupeWithinBatch(normalized)
  const preview = toJournalPreview(
    buildImportPreview(normalized, existingTickets, duplicatesInBatch),
    normalized,
    screenshotUrls,
  )

  const importable = filterImportableTrades(unique, existingTickets)
  const skippedCount = preview.filter((row) => row.status === "duplicate").length

  if (options.dryRun) {
    return {
      dryRun: true,
      preview,
      importedCount: preview.filter((row) => row.status === "ready").length,
      skippedCount,
      errorCount: parseErrors.length,
      errors: parseErrors,
    }
  }

  let importedCount = 0
  const insertErrors: string[] = [...parseErrors]
  let screenshotIndex = 0

  for (const trade of importable) {
    const screenshotUrl = screenshotUrls[screenshotIndex] ?? null
    if (screenshotUrl) screenshotIndex += 1

    const payload = normalizedToJournalInsert(trade, userId, maxRisk, screenshotUrl)
    const err = await insertJournalTrade(supabase, payload)
    if (err) insertErrors.push(`Ticket ${trade.external_ticket}: ${err}`)
    else importedCount += 1
  }

  for (let i = screenshotIndex; i < screenshotUrls.length; i += 1) {
    const payload = screenshotToJournalInsert(userId, screenshotUrls[i], i, maxRisk)
    const err = await insertJournalTrade(supabase, payload)
    if (err) insertErrors.push(`Screenshot ${i + 1}: ${err}`)
    else importedCount += 1
  }

  return {
    dryRun: false,
    preview,
    importedCount,
    skippedCount,
    errorCount: insertErrors.length,
    errors: insertErrors,
  }
}

/** @deprecated Use importJournalUpload */
export const importJournalCsv = importJournalUpload
