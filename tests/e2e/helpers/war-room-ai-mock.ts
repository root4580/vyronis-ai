import type { WarRoomVisionAutofill } from "@/lib/strategy-brain/war-room-vision-types"

/** Fixed autofill payload for Playwright — matches /api/strategy-brain/war-room-vision response shape. */
export function getMockWarRoomVisionAutofill(): WarRoomVisionAutofill {
  return {
    available: true,
    pair: "EURUSD",
    directional_bias: "Bullish",
    aoi_low: 1.082,
    aoi_high: 1.086,
    invalidation: 1.0795,
    weekly_thesis: "Bullish continuation above weekly demand with London session liquidity sweep.",
    notes: "Mock autofill for CI — real AI only runs in staging/manual QA.",
    weekly_bias: "Bullish",
    daily_bias: "Bullish",
    h4_bias: "Neutral",
    confidence: 78,
    inferredStack: "W · D · H4",
    comparisonSummary: "HTF aligned bullish. AOI holds above 1.082. Wait for H4 confirmation before entry.",
    frames: [
      {
        imageIndex: 0,
        inferredTimeframe: "H4",
        displayLabel: "Chart 1",
        trendBias: "Bullish",
        summary: "Higher-low structure holding above demand zone.",
      },
    ],
    setupGrade: "A",
    recommendation: "CAUTION",
  }
}

export function mockWarRoomVisionApiResponse(): { autofill: WarRoomVisionAutofill } {
  return { autofill: getMockWarRoomVisionAutofill() }
}
