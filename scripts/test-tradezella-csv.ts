/**
 * TradeZella-style CSV (no Date column, separate PnL) — npx tsx scripts/test-tradezella-csv.ts
 */
import assert from "node:assert/strict"
import { parseJournalCsvContent, countValidRows } from "../lib/journal/csv-parse-pipeline"

const withCloseTime = `Ticket,Open Time,Close Time,Pair,Direction,Volume,Profit,PnL
26019265,2026-05-28 09:00:00,2026-05-28 10:30:00,USDCHF,SELL,0.1,-94.05,-94.05
`
const r1 = parseJournalCsvContent(withCloseTime)
assert.equal(countValidRows(r1.preview), 1)
assert.equal(r1.preview[0]?.trade_date, "2026-05-28")
assert.equal(r1.preview[0]?.pnl, -94.05)

const screenshotFormat = `Ticket,Open Price,Type,Direction,Volume,Symbol,Pair,SL,TP,Close Price,Swap,Commissions,Profit,PnL,Pips,Trade Duration In Seconds
26019265,1.12,Market,SELL,0.1,USDCHF,USDCHF.sim,1.11,1.13,1.115,0,-1,-94.05,-94.05,10,3600
`
const r2 = parseJournalCsvContent(screenshotFormat)
assert.equal(r2.preview[0]?.pnl, -94.05)
assert.equal(r2.debug.needsDateFixCount, 1, "no date column in this export")
assert.notEqual(r2.preview[0]?.trade_date, "2001-01-12", "must not treat prices as dates")

const r3 = parseJournalCsvContent(screenshotFormat, {
  fallbackDateForMissing: "2026-05-28",
})
assert.equal(countValidRows(r3.preview), 1)
assert.equal(r3.preview[0]?.trade_date, "2026-05-28")

console.log("✓ tradezella CSV tests passed")
