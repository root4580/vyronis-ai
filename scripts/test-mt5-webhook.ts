/**
 * MT5 webhook normalizer — npx tsx scripts/test-mt5-webhook.ts
 */
import assert from "node:assert/strict"
import { normalizeMt5WebhookTrade } from "../lib/mt5/trade-ingest"
import { normalizeMt5WebhookRecord } from "../lib/mt5/payload-parser"

const raw = normalizeMt5WebhookRecord({
  ticket: 26019265,
  symbol: "USDCHF",
  direction: "SELL",
  profit: -72.92,
  close_time: "2026.05.28 10:42:11",
  open_time: "2026.05.28 09:14:22",
  volume: 0.1,
  magic: 92601001,
})

const trade = normalizeMt5WebhookTrade(raw)

assert.equal(trade.external_ticket, "26019265")
assert.equal(trade.pair, "USD/CHF")
assert.equal(trade.direction, "SELL")
assert.equal(trade.result, "LOSS")
assert.equal(trade.pnl, -72.92)
assert.equal(trade.trade_date, "2026-05-28")
assert.ok(trade.closed_at?.includes("2026-05-28"))

const win = normalizeMt5WebhookTrade(
  normalizeMt5WebhookRecord({
    ticket: "1",
    symbol: "EURUSD",
    direction: "buy",
    profit: 50,
  }),
)
assert.equal(win.result, "WIN")
assert.equal(win.pnl, 50)

const be = normalizeMt5WebhookTrade(
  normalizeMt5WebhookRecord({
    ticket: "2",
    symbol: "EURUSD",
    direction: "BUY",
    profit: 0,
  }),
)
assert.equal(be.result, "BE")
assert.equal(be.pnl, 0)

console.log("✓ MT5 webhook normalizer passed")
