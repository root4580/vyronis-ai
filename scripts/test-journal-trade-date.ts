/**
 * Journal trade date parser tests — run: npx tsx scripts/test-journal-trade-date.ts
 */
import assert from "node:assert/strict"
import { parseMt5Csv } from "../lib/research/mt5-csv-parser"
import { normalizeMt5CsvRow } from "../lib/research/trade-normalizer"
import {
  getCalendarDateKey,
  getRawTradeDateTime,
  parseTradeDate,
  resolveTradeDateFromRow,
  toLocalCalendarDateKey,
} from "../lib/journal/trade-date-parser"
import { buildPerformanceHeatmap } from "../lib/performance-heatmap"

const mt5 = parseMt5Csv(
  `Ticket,Close Time,Type,Symbol,Volume,Profit
1,2026.01.02 11:20:00,buy,EURUSD,0.1,25
2,2026.01.03 16:10:00,sell,GBPUSD,0.1,-22
`,
)
const t1 = normalizeMt5CsvRow(mt5.rows[0], 2)
const t2 = normalizeMt5CsvRow(mt5.rows[1], 3)
assert.equal(t1.trade_date, "2026-01-02")
assert.equal(t2.trade_date, "2026-01-03")

const altHeaders = parseMt5Csv(
  `Deal,Exit Time,Direction,Symbol,PnL,Open Time
9,2026-02-10 15:00:00,buy,XAUUSD,10,2026-02-10 12:00:00
`,
)
const alt = normalizeMt5CsvRow(altHeaders.rows[0], 2)
assert.equal(alt.trade_date, "2026-02-10")
assert.equal(getRawTradeDateTime(altHeaders.rows[0]), "2026-02-10 15:00:00")

const splitDate = resolveTradeDateFromRow({
  "close date": "2026.03.05",
  "close time": "09:30:00",
})
assert.ok(splitDate)
assert.equal(splitDate.calendarDateKey, "2026-03-05")

const heatmap = buildPerformanceHeatmap(
  [
    { pnl: 25, result: "WIN", trade_date: "2026-01-02", created_at: "2026-05-01T00:00:00Z" },
    { pnl: -22, result: "LOSS", trade_date: "2026-01-03", created_at: "2026-05-01T00:00:00Z" },
  ],
  new Date(2026, 0, 15),
)
const day2 = heatmap.days.find((d) => d.date === "2026-01-02")
const day3 = heatmap.days.find((d) => d.date === "2026-01-03")
assert.equal(day2?.tradeCount, 1)
assert.equal(day3?.tradeCount, 1)
assert.equal(day2?.pnl, 25)
assert.equal(day3?.pnl, -22)

assert.equal(
  getCalendarDateKey({ trade_date: "2026-01-02", created_at: "2026-05-27T12:00:00Z" }),
  "2026-01-02",
)

const parsed = parseTradeDate("2026.01.02 11:20:00")
assert.ok(parsed)
assert.equal(toLocalCalendarDateKey(parsed), "2026-01-02")

console.log("✓ journal trade date tests passed")
