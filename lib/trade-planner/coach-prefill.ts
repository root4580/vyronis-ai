import { APP_HOME_PATH } from "@/lib/branding"
import {
  formatLotSize,
  formatRiskReward,
} from "@/lib/trade-planner/trade-plan-engine"
import type { TradePlanCalculation } from "@/lib/trade-planner/types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

export const TRADE_PLANNER_COACH_PREFILL_KEY = "vyronis.tradePlannerCoachPrefill"

export type TradePlannerCoachPrefillPayload = {
  tradePlanId?: string
  pair: string
  direction: TradePlanCalculation["direction"]
  riskPercent: number
  entryPrice: number
  stopLoss: number
  takeProfit: number
  slPips: number
  tpPips: number
  rr: number | null
  recommendedLots: number | null
  riskAmount: number
  chartScreenshotUrl?: string | null
  chartPointers?: string[]
}

export function buildTradePlannerCoachPrefill(
  plan: TradePlanCalculation,
  options?: {
    tradePlanId?: string
    chartScreenshotUrl?: string | null
    chartPointers?: string[]
  },
): TradePlannerCoachPrefillPayload {
  return {
    tradePlanId: options?.tradePlanId,
    pair: plan.pair,
    direction: plan.direction,
    riskPercent: plan.riskPercent,
    entryPrice: plan.entryPrice,
    stopLoss: plan.stopLoss,
    takeProfit: plan.takeProfit,
    slPips: plan.slPips,
    tpPips: plan.tpPips,
    rr: plan.rr,
    recommendedLots: plan.recommendedLots,
    riskAmount: plan.riskAmount,
    chartScreenshotUrl: options?.chartScreenshotUrl ?? null,
    chartPointers: options?.chartPointers,
  }
}

export function buildPlannedContextFromTradePlannerPrefill(
  prefill: TradePlannerCoachPrefillPayload,
  maxRiskPerTrade?: number,
): PreTradePlannedContext {
  const lotLabel = formatLotSize(prefill.recommendedLots)
  const rrLabel = formatRiskReward(prefill.rr)
  const planRef = prefill.tradePlanId ? ` · saved plan` : ""
  const chartUrl = prefill.chartScreenshotUrl?.trim() || undefined
  const pointerSummary =
    prefill.chartPointers && prefill.chartPointers.length > 0
      ? prefill.chartPointers.slice(0, 4).join(" · ")
      : undefined

  return {
    pair: prefill.pair,
    direction: prefill.direction === "BUY" ? "LONG" : prefill.direction === "SELL" ? "SHORT" : prefill.direction,
    entry_price: String(prefill.entryPrice),
    stop_loss: String(prefill.stopLoss),
    take_profit: String(prefill.takeProfit),
    risk_percent: String(prefill.riskPercent),
    trade_date: new Date().toISOString().split("T")[0],
    setup: `Trade Planner sizing — ${rrLabel} · SL ${prefill.slPips.toFixed(1)} pips · TP ${prefill.tpPips.toFixed(1)} pips · risk $${prefill.riskAmount.toFixed(2)} · ${lotLabel} std lots${planRef}`,
    chart_url: chartUrl,
    screenshot_url: chartUrl,
    entry_timeframe: chartUrl ? "M15" : undefined,
    confirmation_signal: pointerSummary,
    max_risk_per_trade: maxRiskPerTrade,
  }
}

export function writeTradePlannerCoachPrefill(payload: TradePlannerCoachPrefillPayload): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(TRADE_PLANNER_COACH_PREFILL_KEY, JSON.stringify(payload))
}

export function readTradePlannerCoachPrefill(): TradePlannerCoachPrefillPayload | null {
  if (typeof window === "undefined") return null

  const raw = sessionStorage.getItem(TRADE_PLANNER_COACH_PREFILL_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as TradePlannerCoachPrefillPayload
  } catch {
    return null
  }
}

export function clearTradePlannerCoachPrefill(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(TRADE_PLANNER_COACH_PREFILL_KEY)
}

export function getTradePlannerCoachHref(): string {
  return `${APP_HOME_PATH}?coachPlan=1`
}
