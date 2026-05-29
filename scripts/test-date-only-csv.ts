/**
 * Date-only CSV import — run: npx tsx scripts/test-date-only-csv.ts
 */
import assert from "node:assert/strict"
import { parseJournalCsvContent, countValidRows } from "../lib/journal/csv-parse-pipeline"

const csv = `Ticket,Date,Symbol,Type,Profit
101,2026-05-28,EURUSD,buy,25
102,2026-05-28,GBPUSD,sell,-10
103,2026-05-29,XAUUSD,buy,42
104,2026-05-30,USDJPY,sell,-5
`

const result = parseJournalCsvContent(csv)

assert.equal(result.debug.rawRowCount, 4)
assert.equal(result.debug.needsDateFixCount, 0, "date-only rows must not need date fix")
assert.equal(countValidRows(result.preview), 4, "all 4 rows import-ready")
assert.ok(
  result.preview.every((r) => r.status === "ready" && r.trade_date.startsWith("2026-05")),
  "all rows Ready with parsed trade_date",
)
assert.equal(result.preview.filter((d) => d.trade_date === "2026-05-28").length, 2)

console.log(result.summaryMessage)
console.table(
  result.preview.map((r) => ({
    ticket: r.external_ticket,
    date: r.trade_date,
    status: r.status,
  })),
)
console.log("✓ date-only CSV import passed")
