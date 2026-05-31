import { formatPlanPrice } from "@/lib/trade-planner/trade-plan-engine"
import type { PlanChartAutofillResponse, PlanChartVisionResult } from "@/lib/trade-planner/plan-chart-vision-types"
import {
  buildPlanSlCoaching,
  mergePlanPointers,
} from "@/lib/trade-planner/plan-sl-coaching"
import { isSupportedPlannerPair, normalizeTradePlannerPair } from "@/lib/trade-planner/forex-pairs"
import type { TradePlanDirection } from "@/lib/trade-planner/types"

function resolvePair(visionPair: string, hint?: string): string {
  const normalized = normalizeTradePlannerPair(visionPair || hint || "")
  if (isSupportedPlannerPair(normalized)) return normalized
  const hintNorm = normalizeTradePlannerPair(hint || "")
  return isSupportedPlannerPair(hintNorm) ? hintNorm : normalized || "EURUSD"
}

function resolveDirection(
  visionDirection: TradePlanDirection | "",
  hint?: TradePlanDirection,
): TradePlanDirection {
  if (visionDirection === "BUY" || visionDirection === "SELL") return visionDirection
  return hint === "SELL" ? "SELL" : "BUY"
}

export function buildTradePlanChartAutofill(input: {
  vision: PlanChartVisionResult
  pairHint?: string
  directionHint?: TradePlanDirection
  accountSize: number
  riskPercent: number
}): PlanChartAutofillResponse {
  const { vision, pairHint, directionHint, accountSize, riskPercent } = input
  const pair = resolvePair(vision.pair, pairHint)
  const direction = resolveDirection(vision.direction, directionHint)

  const entryPrice = vision.entryPrice
  const stopLoss = vision.stopLoss
  const takeProfit = vision.takeProfit

  const coachingTips =
    entryPrice && stopLoss
      ? buildPlanSlCoaching({
          pair,
          direction,
          accountSize,
          riskPercent,
          entryPrice,
          stopLoss,
          takeProfit: takeProfit ?? 0,
        })
      : []

  const visionPointers = [
    vision.timeframe ? `Structure — ${vision.pair} ${vision.timeframe} chart` : "",
    vision.summary,
    ...vision.pointers,
  ].filter(Boolean)

  if (vision.suggestedTakeProfit) {
    visionPointers.push(
      `TP — Chart suggests target near ${formatPlanPrice(vision.suggestedTakeProfit, pair)} (liquidity / structure level).`,
    )
  }
  if (vision.suggestedStopLoss) {
    visionPointers.push(
      `SL — Chart suggests invalidation near ${formatPlanPrice(vision.suggestedStopLoss, pair)} — verify before moving stop.`,
    )
  }

  const pointers = mergePlanPointers(visionPointers, coachingTips, pair)

  if (!vision.available || (!entryPrice && !stopLoss && !takeProfit)) {
    return { vision, applied: null, pointers }
  }

  return {
    vision,
    applied: {
      pair,
      direction,
      entryPrice: entryPrice ? formatPlanPrice(entryPrice, pair) : "",
      stopLoss: stopLoss ? formatPlanPrice(stopLoss, pair) : "",
      takeProfit: takeProfit ? formatPlanPrice(takeProfit, pair) : "",
    },
    pointers,
  }
}
