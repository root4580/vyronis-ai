import type { NextRequest } from "next/server"
import type { Mt5TradeWebhookBatchPayload, Mt5TradeWebhookPayload } from "@/lib/mt5/types"

function pickString(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return undefined
}

function pickNumber(raw: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = raw[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/[$,\s]/g, ""))
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return undefined
}

function pickBoolean(raw: Record<string, unknown>, key: string): boolean | undefined {
  const value = raw[key]
  if (typeof value === "boolean") return value
  if (value === "true" || value === "1") return true
  if (value === "false" || value === "0") return false
  return undefined
}

export function normalizeMt5WebhookRecord(raw: Record<string, unknown>): Mt5TradeWebhookPayload {
  const ticket = pickString(raw, ["ticket", "deal", "position", "order", "external_ticket"])
  const symbol = pickString(raw, ["symbol", "pair", "item", "instrument"])
  const direction = pickString(raw, ["direction", "type", "side", "action"])
  const profit = pickNumber(raw, ["profit", "pnl", "pl", "net_profit"])

  if (!ticket) throw new Error("Missing ticket.")
  if (!symbol) throw new Error("Missing symbol.")
  if (!direction) throw new Error("Missing direction.")
  if (profit == null) throw new Error("Missing profit.")

  return {
    api_key: pickString(raw, ["api_key", "apiKey", "key", "secret", "token"]),
    ticket,
    symbol,
    direction,
    profit,
    volume: pickNumber(raw, ["volume", "lots", "size"]),
    open_price: pickNumber(raw, ["open_price", "price_open", "entry_price"]),
    close_price: pickNumber(raw, ["close_price", "price_close", "exit_price"]),
    sl: pickNumber(raw, ["sl", "stop_loss", "stoploss"]),
    tp: pickNumber(raw, ["tp", "take_profit", "takeprofit"]),
    commission: pickNumber(raw, ["commission", "commissions", "fee"]),
    swap: pickNumber(raw, ["swap", "storage"]),
    magic: pickNumber(raw, ["magic", "magic_number", "expert_magic"]),
    open_time: pickString(raw, ["open_time", "opened_at", "time_open"]),
    close_time: pickString(raw, ["close_time", "closed_at", "time_close", "time"]),
    trade_date: pickString(raw, ["trade_date", "date", "day"]),
    comment: pickString(raw, ["comment", "notes"]),
    account_login: pickString(raw, ["account_login", "account", "login"]),
    broker: pickString(raw, ["broker", "server"]),
    research_strategy_id: pickString(raw, ["research_strategy_id", "strategy_id"]),
    replace: pickBoolean(raw, "replace"),
  }
}

export async function readMt5WebhookBody(
  request: NextRequest,
): Promise<Mt5TradeWebhookPayload | Mt5TradeWebhookBatchPayload> {
  const contentType = request.headers.get("content-type") ?? ""
  let raw: unknown

  if (contentType.includes("application/json")) {
    raw = await request.json()
  } else {
    const text = await request.text()
    if (!text.trim()) throw new Error("Empty request body.")
    raw = JSON.parse(text) as unknown
  }

  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid JSON body.")
  }

  const record = raw as Record<string, unknown>

  if (Array.isArray(record.trades)) {
    const trades = record.trades.map((item, index) => {
      if (!item || typeof item !== "object") {
        throw new Error(`Invalid trade at index ${index}.`)
      }
      return normalizeMt5WebhookRecord(item as Record<string, unknown>)
    })
    return {
      api_key: pickString(record, ["api_key", "apiKey", "key", "secret", "token"]),
      trades,
    }
  }

  return normalizeMt5WebhookRecord(record)
}

export function extractMt5ApiKey(
  request: NextRequest,
  body: Mt5TradeWebhookPayload | Mt5TradeWebhookBatchPayload,
): string | null {
  const headerKey =
    request.headers.get("x-api-key")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    null

  if (headerKey) return headerKey

  if ("trades" in body && body.api_key?.trim()) return body.api_key.trim()
  if ("ticket" in body && body.api_key?.trim()) return body.api_key.trim()

  return null
}
