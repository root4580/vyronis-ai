import {
  getPipSize,
  getPipValuePerStandardLot,
  isSupportedPlannerPair,
  normalizeTradePlannerPair,
} from "@/lib/trade-planner/forex-pairs"
import type {
  TradePlanCalculation,
  TradePlanDirection,
  TradePlanInput,
  TradePlanSuggestedAction,
  TradePlanWarning,
} from "@/lib/trade-planner/types"

export function calculatePips(pair: string, fromPrice: number, toPrice: number): number {
  const pipSize = getPipSize(pair)
  if (pipSize <= 0 || !Number.isFinite(fromPrice) || !Number.isFinite(toPrice)) return 0
  return Math.abs(toPrice - fromPrice) / pipSize
}

export function calculateRR(stopLossPips: number, takeProfitPips: number): number | null {
  if (stopLossPips <= 0 || takeProfitPips <= 0) return null
  return takeProfitPips / stopLossPips
}

export function calculateRiskAmount(accountSize: number, riskPercent: number): number {
  if (accountSize <= 0 || riskPercent <= 0) return 0
  return accountSize * (riskPercent / 100)
}

export function calculateLotSize(input: {
  pair: string
  entryPrice: number
  stopLossPips: number
  riskAmount: number
}): { lots: number | null; pipValuePerStandardLot: number } {
  const pipValuePerStandardLot = getPipValuePerStandardLot(input.pair, input.entryPrice)
  if (input.stopLossPips <= 0 || input.riskAmount <= 0 || pipValuePerStandardLot <= 0) {
    return { lots: null, pipValuePerStandardLot }
  }

  const lots = input.riskAmount / (input.stopLossPips * pipValuePerStandardLot)
  if (!Number.isFinite(lots) || lots <= 0) {
    return { lots: null, pipValuePerStandardLot }
  }

  return { lots, pipValuePerStandardLot }
}

export function validateTradePlan(input: TradePlanInput): TradePlanWarning[] {
  const warnings: TradePlanWarning[] = []
  const pair = normalizeTradePlannerPair(input.pair)

  if (!pair) {
    warnings.push({ id: "missing_pair", message: "Select a pair before planning." })
    return warnings
  }

  if (!isSupportedPlannerPair(pair)) {
    warnings.push({ id: "unsupported_pair", message: `${pair} is not supported in Trade Planner yet.` })
  }

  const { entryPrice, stopLoss, takeProfit, direction, riskPercent } = input

  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    warnings.push({ id: "invalid_entry", message: "Entry price must be greater than zero." })
  }
  if (!Number.isFinite(stopLoss) || stopLoss <= 0) {
    warnings.push({ id: "invalid_stop", message: "Stop loss must be greater than zero." })
  }
  if (!Number.isFinite(takeProfit) || takeProfit <= 0) {
    warnings.push({ id: "invalid_target", message: "Take profit must be greater than zero." })
  }

  if (Number.isFinite(entryPrice) && Number.isFinite(stopLoss) && Number.isFinite(takeProfit)) {
    if (direction === "BUY") {
      if (stopLoss >= entryPrice) {
        warnings.push({
          id: "buy_stop_geometry",
          message: "Buy plan: stop loss must be below entry.",
        })
      }
      if (takeProfit <= entryPrice) {
        warnings.push({
          id: "buy_target_geometry",
          message:
            takeProfit < entryPrice
              ? "Buy plan: take profit must be above entry."
              : "Buy plan: take profit must be above entry (cannot equal entry).",
        })
      }
    }

    if (direction === "SELL") {
      if (stopLoss <= entryPrice) {
        warnings.push({
          id: "sell_stop_geometry",
          message: "Sell plan: stop loss must be above entry.",
        })
      }
      if (takeProfit >= entryPrice) {
        warnings.push({
          id: "sell_target_geometry",
          message:
            takeProfit > entryPrice
              ? "Sell plan: take profit is above entry — target must be below entry."
              : "Sell plan: take profit must be below entry (cannot equal entry).",
        })
      }
    }
  }

  const slPips = calculatePips(pair, entryPrice, stopLoss)
  const tpPips = calculatePips(pair, entryPrice, takeProfit)

  if (slPips <= 0) {
    warnings.push({ id: "sl_pips_zero", message: "Stop distance must be greater than zero pips." })
  }
  if (tpPips <= 0) {
    warnings.push({ id: "tp_pips_zero", message: "Target distance must be greater than zero pips." })
  }

  const rr = calculateRR(slPips, tpPips)
  if (rr != null && rr < 2) {
    warnings.push({
      id: "rr_below_2",
      message: `R:R is ${rr.toFixed(2)} — Vyronis minimum is 1:2.`,
    })
  }

  if (riskPercent > 1) {
    warnings.push({
      id: "risk_above_1",
      message: `Risk ${riskPercent}% exceeds 1% — reduce size before planning.`,
    })
  }

  return warnings
}

function resolveSuggestedAction(warnings: TradePlanWarning[], rr: number | null): {
  action: TradePlanSuggestedAction
  label: string
} {
  const hasGeometryIssue = warnings.some((warning) =>
    ["buy_stop_geometry", "buy_target_geometry", "sell_stop_geometry", "sell_target_geometry", "sl_pips_zero", "tp_pips_zero", "missing_pair", "invalid_entry", "invalid_stop", "invalid_target"].includes(
      warning.id,
    ),
  )

  if (hasGeometryIssue) {
    return { action: "skip_plan", label: "Skip — fix entry, stop, and target geometry first." }
  }

  if (warnings.length > 0 || rr == null || rr < 2) {
    return { action: "adjust_plan", label: "Adjust plan — warnings must clear before execution." }
  }

  return { action: "plan_valid", label: "Plan valid — run coach before entry, then log after close." }
}

export function buildTradePlanCalculation(input: TradePlanInput): TradePlanCalculation {
  const pair = normalizeTradePlannerPair(input.pair)
  const slPips = calculatePips(pair, input.entryPrice, input.stopLoss)
  const tpPips = calculatePips(pair, input.entryPrice, input.takeProfit)
  const rr = calculateRR(slPips, tpPips)
  const riskAmount = calculateRiskAmount(input.accountSize, input.riskPercent)
  const { lots, pipValuePerStandardLot } = calculateLotSize({
    pair,
    entryPrice: input.entryPrice,
    stopLossPips: slPips,
    riskAmount,
  })
  const warnings = validateTradePlan(input)
  const suggested = resolveSuggestedAction(warnings, rr)

  return {
    pair,
    direction: input.direction,
    accountSize: input.accountSize,
    riskPercent: input.riskPercent,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    slPips: Number(slPips.toFixed(1)),
    tpPips: Number(tpPips.toFixed(1)),
    rr: rr != null ? Number(rr.toFixed(2)) : null,
    riskAmount: Number(riskAmount.toFixed(2)),
    pipValuePerStandardLot: Number(pipValuePerStandardLot.toFixed(2)),
    recommendedLots: lots != null ? Number(lots.toFixed(2)) : null,
    warnings,
    suggestedAction: suggested.action,
    suggestedActionLabel: suggested.label,
  }
}

export function parseTradePlanNumber(value: string): number {
  const parsed = parseFloat(value.replace(/,/g, "").trim())
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatPlanPrice(value: number, pair: string): string {
  const normalized = normalizeTradePlannerPair(pair)
  const decimals = normalized.endsWith("JPY") || normalized.startsWith("XAU") ? 3 : 5
  return value.toFixed(decimals)
}

export function formatLotSize(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return value.toFixed(2)
}

export function formatRiskReward(rr: number | null): string {
  if (rr == null || rr <= 0) return "—"
  const reward = Number.isInteger(rr) ? rr.toString() : rr.toFixed(2).replace(/\.?0+$/, "")
  return `1:${reward}`
}

export function getStopLossPips(input: TradePlanInput): number {
  return calculatePips(normalizeTradePlannerPair(input.pair), input.entryPrice, input.stopLoss)
}

export function getTakeProfitPips(input: TradePlanInput): number {
  return calculatePips(normalizeTradePlannerPair(input.pair), input.entryPrice, input.takeProfit)
}

export function isBuyDirection(direction: TradePlanDirection): boolean {
  return direction === "BUY"
}
