import type { TradeFormState } from "@/lib/trade-form-config"

export function parseOptionalNumber(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function calculateRiskReward(form: Pick<TradeFormState, "direction" | "entry_price" | "stop_loss" | "take_profit">): number | null {
  const entry = parseFloat(form.entry_price)
  const stop = parseFloat(form.stop_loss)
  const target = parseFloat(form.take_profit)

  if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(target)) return null

  const isBuy = form.direction === "BUY"
  const risk = isBuy ? entry - stop : stop - entry
  const reward = isBuy ? target - entry : entry - target

  if (risk <= 0 || reward <= 0) return null
  return reward / risk
}

export function calculatePositionSize(
  form: Pick<TradeFormState, "entry_price" | "stop_loss" | "risk_percent">,
  accountBalance: number,
): { riskAmount: number; units: number; pipRisk: number } | null {
  const entry = parseFloat(form.entry_price)
  const stop = parseFloat(form.stop_loss)
  const riskPercent = parseFloat(form.risk_percent)

  if (!entry || !stop || !riskPercent || accountBalance <= 0) return null

  const pipRisk = Math.abs(entry - stop)
  if (pipRisk <= 0) return null

  const riskAmount = accountBalance * (riskPercent / 100)
  const units = riskAmount / pipRisk

  return { riskAmount, units, pipRisk }
}

export function suggestPnLFromResult(
  form: Pick<TradeFormState, "result" | "risk_percent">,
  accountBalance: number,
  riskReward: number | null,
): string {
  const riskPercent = parseFloat(form.risk_percent)
  if (!form.result || !riskPercent || accountBalance <= 0) return ""

  const riskAmount = accountBalance * (riskPercent / 100)

  if (form.result === "BREAKEVEN") return "0"
  if (form.result === "LOSS") return riskAmount.toFixed(2)
  if (form.result === "WIN") {
    const rr = riskReward && riskReward > 0 ? riskReward : 2
    return (riskAmount * rr).toFixed(2)
  }

  return ""
}

export function formatRiskReward(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—"
  const reward = Number.isInteger(value) ? value.toString() : value.toFixed(1).replace(/\.0$/, "")
  return `1:${reward}`
}

/** Dashboard aggregate R:R — explicit when journal lacks planned levels. */
export function formatAverageRiskReward(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "N/A"
  return formatRiskReward(value)
}

export function calculateTradeRiskReward(trade: {
  direction: string
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
}): number | null {
  return calculateRiskReward({
    direction: trade.direction,
    entry_price: trade.entry_price?.toString() ?? "",
    stop_loss: trade.stop_loss?.toString() ?? "",
    take_profit: trade.take_profit?.toString() ?? "",
  })
}

export function getTradeRiskReward(trade: {
  direction: string
  risk_reward?: number | null
  rr?: number | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
}): number | null {
  if (trade.risk_reward != null && Number.isFinite(trade.risk_reward) && trade.risk_reward > 0) {
    return trade.risk_reward
  }
  if (trade.rr != null && Number.isFinite(trade.rr) && trade.rr > 0) {
    return trade.rr
  }
  return calculateTradeRiskReward(trade)
}
