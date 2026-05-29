/**
 * Journal CSV profit + date mapping — npx tsx scripts/test-journal-profit-csv.ts
 */
import assert from "node:assert/strict"
import { parseCsvProfit } from "../lib/journal/journal-csv-mapper"
import { parseJournalCsvContent, countValidRows } from "../lib/journal/csv-parse-pipeline"

assert.equal(parseCsvProfit("-72.92"), -72.92)
assert.equal(parseCsvProfit("-49.53"), -49.53)
assert.equal(parseCsvProfit("0"), 0)
assert.equal(parseCsvProfit("+50"), 50)
assert.equal(parseCsvProfit("$-72.92"), -72.92)
assert.equal(parseCsvProfit("-$72.92"), -72.92)

const csv = `Ticket,Date,Symbol,Type,Profit
T1,2026-05-28,EURUSD,buy,-72.92
T2,2026-05-28,GBPUSD,sell,-49.53
T3,2026-05-29,XAUUSD,buy,0
T4,2026-05-30,USDJPY,sell,+50
`

const result = parseJournalCsvContent(csv)

assert.equal(result.debug.rawRowCount, 4)
assert.equal(countValidRows(result.preview), 4)
assert.equal(result.preview[0]?.trade_date, "2026-05-28")
assert.equal(result.preview[0]?.pnl, -72.92)
assert.equal(result.preview[1]?.pnl, -49.53)
assert.equal(result.preview[2]?.pnl, 0)
assert.equal(result.preview[3]?.pnl, 50)
assert.equal(result.preview[0]?.status, "ready")

assert.ok(result.debug.columnDiagnostics?.detectedDateHeader === "Date")
assert.ok(result.debug.columnDiagnostics?.detectedProfitHeader === "Profit")
assert.equal(result.debug.columnDiagnostics?.firstRowRaw.trade_date, "2026-05-28")
assert.equal(result.debug.columnDiagnostics?.firstRowRaw.profit, "-72.92")

console.log(result.summaryMessage)
console.log("✓ journal profit CSV mapping passed")
