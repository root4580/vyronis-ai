import type { TradingViewAlertPayload } from "@/lib/tradingview/types"

const PAIR_ALIASES: Record<string, string> = {
  GOLD: "XAUUSD",
  XAU: "XAUUSD",
  SILVER: "XAGUSD",
  XAG: "XAGUSD",
  NAS100: "NAS100",
  US100: "NAS100",
  US30: "US30",
  SPX500: "SPX500",
  BTC: "BTCUSD",
  ETH: "ETHUSD",
}

export function normalizeSymbol(symbol: string): string {
  const cleaned = symbol
    .trim()
    .toUpperCase()
    .replace(/^BINANCE:/, "")
    .replace(/^OANDA:/, "")
    .replace(/^FX:/, "")
    .replace(/^FOREXCOM:/, "")
    .replace(/[^A-Z0-9]/g, "")

  if (!cleaned) return "UNKNOWN"
  return PAIR_ALIASES[cleaned] || cleaned
}

export function normalizeDirection(direction: string): "BUY" | "SELL" {
  const value = direction.trim().toUpperCase()
  if (value === "SELL" || value === "SHORT" || value === "SELL_LIMIT" || value === "SELL_STOP") {
    return "SELL"
  }
  return "BUY"
}

export function parseEntryPrice(entryZone: string | null | undefined): string | undefined {
  if (!entryZone?.trim()) return undefined
  const zone = entryZone.trim()
  const parts = zone.split(/[-–—]/).map((part) => part.trim())
  if (parts.length === 2) {
    const low = parseFloat(parts[0])
    const high = parseFloat(parts[1])
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return String((low + high) / 2)
    }
  }
  return zone
}

export function normalizeAlertPayload(payload: TradingViewAlertPayload) {
  return {
    symbol: normalizeSymbol(payload.symbol),
    direction: normalizeDirection(payload.direction),
    timeframe: payload.timeframe?.trim() || null,
    strategy_name: payload.strategy_name?.trim() || null,
    entry_zone: payload.entry_zone?.trim() || null,
    entry_price: parseEntryPrice(payload.entry_zone),
    stop_loss: payload.stop_loss ?? null,
    take_profit: payload.take_profit ?? null,
    confidence: payload.confidence ?? null,
    message: payload.message?.trim() || null,
    chart_url: payload.chart_url?.trim() || null,
    external_alert_id: payload.alert_id?.trim() || null,
  }
}

export function computeRiskRewardRatio(input: {
  direction: "BUY" | "SELL"
  entry_price?: string | null
  entry_zone?: string | null
  stop_loss?: number | null
  take_profit?: number | null
}): number | null {
  const entry =
    parseFloat(input.entry_price || parseEntryPrice(input.entry_zone) || "") ||
    null
  const sl = input.stop_loss
  const tp = input.take_profit
  if (entry === null || sl == null || tp == null) return null

  const risk = input.direction === "BUY" ? entry - sl : sl - entry
  const reward = input.direction === "BUY" ? tp - entry : entry - tp
  if (risk <= 0 || reward <= 0) return null
  return Math.round((reward / risk) * 100) / 100
}
