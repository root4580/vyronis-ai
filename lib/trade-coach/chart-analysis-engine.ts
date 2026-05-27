import {
  analyzeChartVisionForContext,
  buildChartVisionMessages,
  chartVisionToLegacyAnalysis,
  normalizeChartVision,
} from "@/lib/coach/chart-vision-engine"
import type { ChartAnalysisResult, PreTradePlannedContext } from "@/lib/trade-coach/types"

export function analyzeChartTradeSetup(context: PreTradePlannedContext): ChartAnalysisResult {
  const screenshotUrl = context.chart_url || context.screenshot_url || ""
  if (screenshotUrl) {
    throw new Error("Use analyzeChartVisionForContext for async chart vision analysis.")
  }

  return chartVisionToLegacyAnalysis({
    version: 2,
    visionScore: 0,
    detectedSetup: context.confirmation_signal || context.setup || "Chart setup",
    trendBias: "neutral",
    warnings: ["Upload a chart screenshot for Chart Vision analysis."],
    strengths: [],
    executionQuality: 0,
    confidence: 0,
    metrics: {
      trendDirection: "neutral",
      countertrend: false,
      rrQuality: 0,
      impulsiveEntryDistance: 50,
      emaAlignment: 0,
      supportResistanceProximity: 0,
      breakoutVsRetest: "unknown",
      confirmationCandleQuality: 0,
      overextendedMove: false,
      volatilityState: "normal",
    },
    provider: "heuristic",
    analyzedAt: new Date().toISOString(),
    summary: "Chart screenshot required for vision analysis.",
    insights: [],
  })
}

export function normalizeChartAnalysis(
  analysis: Partial<ChartAnalysisResult> | null | undefined,
  context?: PreTradePlannedContext,
): ChartAnalysisResult | null {
  const screenshotUrl = context?.chart_url || context?.screenshot_url
  const vision = normalizeChartVision(analysis, context, screenshotUrl)
  if (vision) {
    return chartVisionToLegacyAnalysis(vision)
  }

  if (!analysis || typeof analysis !== "object") {
    return null
  }

  return {
    overallScore: analysis.overallScore ?? 0,
    executionQuality: analysis.executionQuality ?? 0,
    trendAlignment: analysis.trendAlignment ?? 0,
    confirmationStrength: analysis.confirmationStrength ?? 0,
    rrQuality: analysis.rrQuality ?? 0,
    countertrend: analysis.countertrend ?? false,
    overextendedEntry: analysis.overextendedEntry ?? false,
    warnings: analysis.warnings ?? [],
    strengths: analysis.strengths ?? [],
    summary: analysis.summary ?? "Chart analysis pending.",
    insights: analysis.insights ?? [],
  }
}

export function buildChartAnalysisMessages(analysis: ChartAnalysisResult): string[] {
  if (analysis.vision) {
    return buildChartVisionMessages(analysis.vision)
  }

  const messages = [analysis.summary]
  if ((analysis.insights?.length ?? 0) > 0) {
    messages.push(`Chart read: ${(analysis.insights ?? []).join(" · ")}.`)
  }
  if ((analysis.warnings?.length ?? 0) > 0) {
    messages.push(`Chart warnings: ${(analysis.warnings ?? []).slice(0, 3).join(" · ")}.`)
  }
  messages.push(
    "Quick check next — just 2-3 questions on emotion and risk, then I'll score trade quality.",
  )
  return messages
}

export {
  analyzeChartVisionForContext,
  buildChartVisionMessages,
  chartVisionToLegacyAnalysis,
  normalizeChartVision,
} from "@/lib/coach/chart-vision-engine"
