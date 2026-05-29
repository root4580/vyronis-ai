/**
 * trading-journal-clean.csv — run: npx tsx scripts/test-trading-journal-clean-csv.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parseJournalCsvContent, countValidRows } from "../lib/journal/csv-parse-pipeline"

const csv = readFileSync(
  join(process.cwd(), "fixtures/trading-journal-clean.csv"),
  "utf8",
)

const result = parseJournalCsvContent(csv)

assert.equal(result.debug.rawRowCount, 4)
assert.equal(result.preview.length, 4)
assert.equal(countValidRows(result.preview), 4)
assert.equal(result.debug.needsDateFixCount, 0)

const dates = new Set(result.preview.map((r) => r.trade_date))
assert.equal(dates.size, 3, "trades on 3 calendar days")

assert.equal(result.preview[0]?.pnl, -72.92)
assert.equal(result.preview[0]?.trade_date, "2026-05-28")

console.log(result.summaryMessage)
console.table(
  result.preview.map((r) => ({
    ticket: r.external_ticket,
    date: r.trade_date,
    pnl: r.pnl,
    status: r.status,
  })),
)
console.log("✓ trading-journal-clean.csv passed")
