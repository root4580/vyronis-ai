/**
 * MT5 Research Lab parser tests — run: npm run test:research
 */
import assert from "node:assert/strict"
import { dedupeWithinBatch, filterImportableTrades } from "../lib/research/dedupe"
import { parseMt5Csv } from "../lib/research/mt5-csv-parser"
import { normalizeMt5CsvRow } from "../lib/research/trade-normalizer"
import { filterTradesByScope } from "../lib/analytics/trade-scope"
import { buildStrategyPerformance } from "../lib/strategy-performance"

const sampleCsv = `Ticket,Open Time,Type,Size,Item,Price,S / L,T / P,Close Time,Price,Commission,Swap,Profit,Comment
1001,2026.01.02 09:15:00,buy,0.10,EURUSD,1.08500,1.08300,1.08900,2026.01.02 11:20:00,1.08750,0.00,0.00,25.00,London breakout
1002,2026.01.03 14:05:00,sell,0.10,GBPUSD,1.27500,1.27800,1.27000,2026.01.03 16:10:00,1.27720,0.00,-0.50,-22.00,NY fade
1001,2026.01.02 09:15:00,buy,0.10,EURUSD,1.08500,1.08300,1.08900,2026.01.02 11:20:00,1.08750,0.00,0.00,25.00,duplicate row
`

const parsed = parseMt5Csv(sampleCsv)
assert.equal(parsed.rows.length, 3)

const trade1 = normalizeMt5CsvRow(parsed.rows[0], 2)
assert.equal(trade1.external_ticket, "1001")
assert.equal(trade1.pair, "EUR/USD")
assert.equal(trade1.direction, "BUY")
assert.equal(trade1.result, "WIN")
assert.equal(trade1.pnl, 25)
assert.equal(trade1.trade_date, "2026-01-02")

const trade2 = normalizeMt5CsvRow(parsed.rows[1], 3)
assert.equal(trade2.trade_date, "2026-01-03")
assert.notEqual(trade1.trade_date, trade2.trade_date)

const { unique, duplicatesInBatch } = dedupeWithinBatch([
  trade1,
  normalizeMt5CsvRow(parsed.rows[1], 3),
  normalizeMt5CsvRow(parsed.rows[2], 4),
])
assert.equal(unique.length, 2)
assert.deepEqual(duplicatesInBatch, ["1001"])

const importable = filterImportableTrades(
  [trade1, normalizeMt5CsvRow(parsed.rows[1], 3), normalizeMt5CsvRow(parsed.rows[2], 4)],
  new Set(["1001"]),
)
assert.equal(importable.length, 1)
assert.equal(importable[0]?.external_ticket, "1002")

const scoped = filterTradesByScope(
  [
    { import_source: "manual" } as never,
    { import_source: "mt5_csv" } as never,
  ],
  "research",
)
assert.equal(scoped.length, 1)

const comparison = buildStrategyPerformance(
  [
    { pnl: 25, result: "WIN", strategy_name: "EA A", research_strategy_id: "s1" },
    { pnl: 10, result: "WIN", strategy_name: "EA A", research_strategy_id: "s1" },
    { pnl: -22, result: "LOSS", strategy_name: "EA B", research_strategy_id: "s2" },
  ],
  { groupBy: "research_strategy_id" },
)
assert.equal(comparison.strategies.length, 2)
assert.equal(comparison.groupBy, "research_strategy_id")

console.log("✓ research lab tests passed")
