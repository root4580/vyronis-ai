import type { WarRoomVisionAutofill } from "@/lib/strategy-brain/war-room-vision-types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import type { BiasDirection, PairPlanInput, WeeklyPlanWithPairs } from "@/lib/strategy-brain/types"
export function plannedContextPatchFromVision(
  autofill: WarRoomVisionAutofill,
): Partial<PreTradePlannedContext> {
  const direction =
    autofill.directional_bias === "Bullish"
      ? "LONG"
      : autofill.directional_bias === "Bearish"
        ? "SHORT"
        : undefined

  return {
    pair: autofill.pair,
    direction,
    strategy_name: "Multi-Timeframe FX Continuation Setup",
    higher_timeframe: "Weekly / Daily / H4",
    entry_timeframe: "H1",
    confirmation_timeframe: "M15",
    setup: autofill.weekly_thesis || undefined,
  }
}

export function mergeAutofillIntoWeeklyPlan(
  plan: WeeklyPlanWithPairs | null,
  autofill: WarRoomVisionAutofill,
  screenshotUrls: string[],
): PairPlanInput[] {
  const existing = plan?.pairs ?? []
  const key = autofill.pair.toUpperCase().replace(/[^A-Z]/g, "")
  const idx = existing.findIndex(
    (p) => p.pair.toUpperCase().replace(/[^A-Z]/g, "") === key,
  )

  const row: PairPlanInput = {
    pair: autofill.pair,
    directional_bias: autofill.directional_bias,
    aoi_low: autofill.aoi_low,
    aoi_high: autofill.aoi_high,
    invalidation: autofill.invalidation,
    weekly_thesis: autofill.weekly_thesis,
    notes: autofill.notes,
    screenshot_urls: screenshotUrls.slice(0, 5),
    sort_order: idx >= 0 ? existing[idx].sort_order : existing.length,
  }

  if (idx >= 0) {
    return existing.map((p, i) =>
      i === idx
        ? {
            pair: row.pair,
            directional_bias: row.directional_bias,
            aoi_high: row.aoi_high,
            aoi_low: row.aoi_low,
            invalidation: row.invalidation,
            weekly_thesis: row.weekly_thesis,
            notes: row.notes,
            screenshot_urls: row.screenshot_urls,
            aoi_status: p.aoi_status,
            sort_order: p.sort_order,
          }
        : {
            pair: p.pair,
            directional_bias: p.directional_bias,
            aoi_high: p.aoi_high,
            aoi_low: p.aoi_low,
            invalidation: p.invalidation,
            weekly_thesis: p.weekly_thesis,
            notes: p.notes,
            aoi_status: p.aoi_status,
            screenshot_urls: p.screenshot_urls ?? [],
            sort_order: p.sort_order,
          },
    )
  }

  return [
    ...existing.map((p) => ({
      pair: p.pair,
      directional_bias: p.directional_bias,
      aoi_high: p.aoi_high,
      aoi_low: p.aoi_low,
      invalidation: p.invalidation,
      weekly_thesis: p.weekly_thesis,
      notes: p.notes,
      aoi_status: p.aoi_status,
      screenshot_urls: p.screenshot_urls ?? [],
      sort_order: p.sort_order,
    })),
    row,
  ]
}

export function marketBiasInputFromVision(autofill: WarRoomVisionAutofill): {
  weekly_bias: BiasDirection
  daily_bias: BiasDirection
  h4_bias: BiasDirection
} {
  return {
    weekly_bias: autofill.weekly_bias,
    daily_bias: autofill.daily_bias,
    h4_bias: autofill.h4_bias,
  }
}
