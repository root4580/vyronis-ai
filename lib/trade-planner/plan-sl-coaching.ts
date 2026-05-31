import { calculatePips, formatPlanPrice } from "@/lib/trade-planner/trade-plan-engine"
import { getPipSize, normalizeTradePlannerPair } from "@/lib/trade-planner/forex-pairs"
import type { TradePlanDirection, TradePlanInput } from "@/lib/trade-planner/types"

export type PlanSlCoachingTip = {
  id: string
  tone: "info" | "warn" | "action"
  message: string
  /** Illustrative tighter stop — trader must confirm on chart. */
  suggestedStopLoss?: number | null
}

type SlPipThresholds = {
  tightBelow: number
  wideAbove: number
}

function thresholdsForPair(pair: string): SlPipThresholds {
  const normalized = normalizeTradePlannerPair(pair)
  if (normalized.startsWith("XAU")) return { tightBelow: 12, wideAbove: 70 }
  if (normalized.startsWith("XAG")) return { tightBelow: 10, wideAbove: 50 }
  if (normalized.includes("JPY")) return { tightBelow: 8, wideAbove: 35 }
  return { tightBelow: 10, wideAbove: 30 }
}

function illustrativeTighterStop(input: {
  pair: string
  direction: TradePlanDirection
  entryPrice: number
  stopLoss: number
  factor?: number
}): number | null {
  const { pair, direction, entryPrice, stopLoss, factor = 0.8 } = input
  const slPips = calculatePips(pair, entryPrice, stopLoss)
  if (slPips <= 0) return null

  const pipSize = getPipSize(pair)
  if (pipSize <= 0) return null

  const tighterPips = slPips * factor
  const tighter =
    direction === "BUY" ? entryPrice - tighterPips * pipSize : entryPrice + tighterPips * pipSize

  if (!Number.isFinite(tighter) || tighter <= 0) return null
  if (direction === "BUY" && tighter >= entryPrice) return null
  if (direction === "SELL" && tighter <= entryPrice) return null

  const normalized = normalizeTradePlannerPair(pair)
  const decimals = normalized.endsWith("JPY") || normalized.startsWith("XAU") ? 3 : 5
  return Number(tighter.toFixed(decimals))
}

export function buildPlanSlCoaching(input: TradePlanInput): PlanSlCoachingTip[] {
  const pair = normalizeTradePlannerPair(input.pair)
  const tips: PlanSlCoachingTip[] = []
  const { entryPrice, stopLoss, takeProfit, direction } = input

  if (
    !Number.isFinite(entryPrice) ||
    entryPrice <= 0 ||
    !Number.isFinite(stopLoss) ||
    stopLoss <= 0
  ) {
    return tips
  }

  const slPips = calculatePips(pair, entryPrice, stopLoss)
  if (slPips <= 0) return tips

  const { tightBelow, wideAbove } = thresholdsForPair(pair)

  if (slPips < tightBelow) {
    tips.push({
      id: "sl_too_tight",
      tone: "warn",
      message: `Stop is only ${slPips.toFixed(1)} pips — likely too tight for ${pair}. Widen SL behind structure; do not move it closer.`,
    })
  } else if (slPips > wideAbove) {
    const suggested = illustrativeTighterStop({
      pair,
      direction,
      entryPrice,
      stopLoss,
      factor: 0.75,
    })
    tips.push({
      id: "sl_too_wide",
      tone: "action",
      message: `Stop is ${slPips.toFixed(1)} pips wide — if invalidation is closer on your chart, consider lowering (tightening) SL to cut risk and improve lot efficiency.`,
      suggestedStopLoss: suggested,
    })
  } else {
    tips.push({
      id: "sl_reasonable",
      tone: "info",
      message: `Stop distance (${slPips.toFixed(1)} pips) looks reasonable for ${pair} — confirm it sits beyond structure, not inside noise.`,
    })
  }

  if (Number.isFinite(takeProfit) && takeProfit > 0) {
    const tpPips = calculatePips(pair, entryPrice, takeProfit)
    const rr = tpPips / slPips
    if (rr < 2 && rr > 0) {
      tips.push({
        id: "rr_below_2_sl_option",
        tone: "action",
        message: `R:R is 1:${rr.toFixed(2)} — extend TP toward the next liquidity sweep / swing high (or swing low for sells), or tighten SL only if structure allows.`,
        suggestedStopLoss:
          slPips > tightBelow
            ? illustrativeTighterStop({ pair, direction, entryPrice, stopLoss, factor: 0.85 })
            : null,
      })
    } else if (rr >= 2) {
      tips.push({
        id: "rr_ok",
        tone: "info",
        message: `R:R is 1:${rr.toFixed(2)} — meets Vyronis 1:2 minimum. Confirm TP sits at real liquidity, not mid-range.`,
      })
    }
  }

  return tips
}

export function formatSlCoachingTip(tip: PlanSlCoachingTip, pair: string): string {
  if (tip.suggestedStopLoss == null) return tip.message
  return `${tip.message} Example tighter level: ${formatPlanPrice(tip.suggestedStopLoss, pair)} (verify on chart).`
}

export function mergePlanPointers(
  visionPointers: string[],
  coachingTips: PlanSlCoachingTip[],
  pair: string,
  limit = 7,
): string[] {
  const fromCoaching = coachingTips.map((tip) => {
    const formatted = formatSlCoachingTip(tip, pair)
    if (tip.id.startsWith("sl_")) return `SL — ${formatted}`
    if (tip.id.startsWith("rr_")) return `R:R — ${formatted}`
    return formatted
  })

  const merged = [...visionPointers, ...fromCoaching]
  const seen = new Set<string>()
  const unique: string[] = []
  for (const line of merged) {
    const key = line.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(line.trim())
  }
  return unique.slice(0, limit)
}
