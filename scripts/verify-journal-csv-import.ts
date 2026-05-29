/**
 * Journal CSV import verification — run:
 *   npx tsx scripts/verify-journal-csv-import.ts path/to/trades.csv
 *
 * Prints per-row date logs and calendar day spread (no database required).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { parseMt5Csv } from "../lib/research/mt5-csv-parser"
import { normalizeMt5CsvRow } from "../lib/research/trade-normalizer"
import type { NormalizedResearchTrade } from "../lib/research/types"
import {
  buildJournalCalendarSummary,
  buildJournalDateLogs,
} from "../lib/journal/csv-import"
import { buildPerformanceHeatmap } from "../lib/performance-heatmap"

const csvPath = process.argv[2]
if (!csvPath) {
  console.error("Usage: npx tsx scripts/verify-journal-csv-import.ts <path-to.csv>")
  process.exit(1)
}

const content = readFileSync(resolve(csvPath), "utf8")
const parsed = parseMt5Csv(content)
const normalized: NormalizedResearchTrade[] = []
const errors: string[] = []

parsed.rows.forEach((row, index) => {
  try {
    normalized.push(normalizeMt5CsvRow(row, index + 2))
  } catch (error) {
    errors.push(error instanceof Error ? error.message : `Row ${index + 2}: failed`)
  }
})

if (normalized.length === 0) {
  console.error("No valid rows.", errors)
  process.exit(1)
}

const dateLogs = buildJournalDateLogs(normalized)
const calendarSummary = buildJournalCalendarSummary(normalized)

console.log("\n=== Per-row date parse log ===\n")
console.table(
  dateLogs.map((log) => ({
    row: log.rowNumber,
    ticket: log.ticket,
    originalCsvDateTime: log.originalCsvDateTime,
    parsedDate: log.parsedDate,
    calendarDate: log.calendarDate,
    pnl: log.pnl,
  })),
)

console.log("\n=== Calendar spread (unique days) ===\n")
console.log("Dates:", calendarSummary.uniqueDates.join(", "))
console.table(calendarSummary.tradesPerDate)

assert.ok(
  calendarSummary.uniqueDates.length > 1 || normalized.length === 1,
  "Expected trades on multiple calendar days (or only one trade in file)",
)

const ref = new Date(normalized[0].trade_date + "T12:00:00")
const heatmap = buildPerformanceHeatmap(
  normalized.map((t) => ({
    pnl: t.pnl,
    result: t.result,
    trade_date: t.trade_date,
    created_at: new Date().toISOString(),
  })),
  ref,
)

const activeDays = heatmap.days.filter((d) => d.inMonth && d.tradeCount > 0)
console.log("\n=== Heatmap days with trades ===\n")
console.table(
  activeDays.map((d) => ({
    date: d.date,
    pnl: d.pnl,
    tradeCount: d.tradeCount,
    winRate: `${d.winRate}%`,
  })),
)

assert.equal(activeDays.length, calendarSummary.uniqueDates.length)

if (errors.length) {
  console.warn("\nParse warnings:", errors)
}

console.log("\n✓ Journal CSV verification passed — trades spread across", activeDays.length, "day(s)")
