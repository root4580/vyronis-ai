import type { TradingViewAlertPayload } from "@/lib/tradingview/types"

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return null
}

function normalizeRecord(raw: Record<string, unknown>): TradingViewAlertPayload {
  const secret = pickString(raw, ["secret", "webhook_secret", "token"])
  const symbol = pickString(raw, ["symbol", "ticker", "pair"]) || ""
  const direction =
    pickString(raw, ["direction", "side", "action", "strategy.order.action"]) || ""
  return {
    secret: secret ?? undefined,
    symbol,
    timeframe: pickString(raw, ["timeframe", "interval", "tf"]),
    direction,
    strategy_name: pickString(raw, ["strategy_name", "strategy", "strategy.name"]),
    entry_zone: pickString(raw, ["entry_zone", "entry", "entry_price", "price"]),
    stop_loss: parseNumber(raw.stop_loss ?? raw.sl ?? raw.stop),
    take_profit: parseNumber(raw.take_profit ?? raw.tp ?? raw.target),
    confidence: parseNumber(raw.confidence ?? raw.confidence_score),
    message: pickString(raw, ["message", "alert_message", "text", "comment"]),
    chart_url: pickString(raw, ["chart_url", "chart", "url"]),
    alert_id: pickString(raw, ["alert_id", "id", "alertId"]),
  }
}

/** Parse TradingView webhook body (JSON object or JSON string). */
export function parseTradingViewWebhookBody(body: unknown): TradingViewAlertPayload {
  if (body === null || body === undefined) {
    return { symbol: "", direction: "" }
  }

  if (typeof body === "string") {
    const trimmed = body.trim()
    if (!trimmed) return { symbol: "", direction: "" }
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return normalizeRecord(parsed as Record<string, unknown>)
      }
    } catch {
      return parsePlainTextAlert(trimmed)
    }
    return parsePlainTextAlert(trimmed)
  }

  if (typeof body === "object" && !Array.isArray(body)) {
    return normalizeRecord(body as Record<string, unknown>)
  }

  return { symbol: "", direction: "" }
}

function parsePlainTextAlert(text: string): TradingViewAlertPayload {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const record: Record<string, unknown> = { message: text }

  for (const line of lines) {
    const match = line.match(/^([a-zA-Z0-9_.]+)\s*[:=]\s*(.+)$/)
    if (match) {
      record[match[1].toLowerCase()] = match[2].trim()
    }
  }

  return normalizeRecord(record)
}

export async function readTradingViewRequestBody(request: Request): Promise<TradingViewAlertPayload> {
  const contentType = request.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    try {
      const json = await request.json()
      return parseTradingViewWebhookBody(json)
    } catch {
      return { symbol: "", direction: "" }
    }
  }

  const text = await request.text()
  if (!text.trim()) return { symbol: "", direction: "" }

  try {
    return parseTradingViewWebhookBody(JSON.parse(text))
  } catch {
    return parseTradingViewWebhookBody(text)
  }
}
