import { buildTradePlanChartAutofill } from "@/lib/trade-planner/chart-autofill"
import { analyzeTradePlanChartScreenshot } from "@/lib/trade-planner/plan-chart-vision-engine"
import type { TradePlanDirection } from "@/lib/trade-planner/types"

export type PaperChartConfidenceTier = "high" | "medium" | "low"

export type PaperChartAutofillResult = {
  chartImageUrl: string
  confidence: number
  confidenceTier: PaperChartConfidenceTier
  confidenceLabel: string
  aiFilledFields: Array<"symbol" | "direction" | "entry" | "sl" | "tp" | "notes">
  applied: {
    symbol: string
    direction: string
    entry: number | null
    sl: number | null
    tp: number | null
    notes: string
  } | null
  summary: string
}

export function mapPaperChartConfidence(confidence: number): {
  tier: PaperChartConfidenceTier
  label: string
} {
  if (confidence >= 75) {
    return { tier: "high", label: "✅ High confidence" }
  }
  if (confidence >= 40) {
    return { tier: "medium", label: "⚠️ Please verify levels" }
  }
  return { tier: "low", label: "❓ Manual entry recommended" }
}

export async function buildPaperChartAutofill(input: {
  imageUrl: string
  symbolHint?: string
  directionHint?: TradePlanDirection
}): Promise<PaperChartAutofillResult> {
  const vision = await analyzeTradePlanChartScreenshot({
    imageUrl: input.imageUrl,
    pairHint: input.symbolHint?.trim(),
    directionHint: input.directionHint,
  })

  const autofill = buildTradePlanChartAutofill({
    vision,
    pairHint: input.symbolHint?.trim(),
    directionHint: input.directionHint,
    accountSize: 0,
    riskPercent: 0.5,
  })

  const { tier, label } = mapPaperChartConfidence(vision.confidence)
  const aiFilledFields: PaperChartAutofillResult["aiFilledFields"] = []

  if (!autofill.applied) {
    return {
      chartImageUrl: input.imageUrl,
      confidence: vision.confidence,
      confidenceTier: tier,
      confidenceLabel: label,
      aiFilledFields,
      applied: null,
      summary: vision.summary,
    }
  }

  const applied = autofill.applied
  const entry = applied.entryPrice ? parseFloat(applied.entryPrice) : null
  const sl = applied.stopLoss ? parseFloat(applied.stopLoss) : null
  const tp = applied.takeProfit ? parseFloat(applied.takeProfit) : null
  const notesParts = [vision.summary, ...autofill.pointers.slice(0, 3)].filter(Boolean)
  const notes = notesParts.join("\n")

  if (applied.pair) aiFilledFields.push("symbol")
  if (applied.direction) aiFilledFields.push("direction")
  if (entry != null) aiFilledFields.push("entry")
  if (sl != null) aiFilledFields.push("sl")
  if (tp != null) aiFilledFields.push("tp")
  if (notes.trim()) aiFilledFields.push("notes")

  return {
    chartImageUrl: input.imageUrl,
    confidence: vision.confidence,
    confidenceTier: tier,
    confidenceLabel: label,
    aiFilledFields,
    applied: {
      symbol: applied.pair,
      direction: applied.direction,
      entry: Number.isFinite(entry) ? entry : null,
      sl: Number.isFinite(sl) ? sl : null,
      tp: Number.isFinite(tp) ? tp : null,
      notes,
    },
    summary: vision.summary,
  }
}
