import { MTF_SLOTS, type CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import type { MtfAnalysisResult, MtfScreenshotMap } from "@/lib/coach/mtf-types"
import type {
  PreTradePlannedContext,
  TradeCoachSessionRecord,
  TradeCoachSessionWithMessages,
} from "@/lib/trade-coach/types"

export function getMtfScreenshotsFromSession(
  session: Pick<
    TradeCoachSessionRecord,
    | "weekly_screenshot_url"
    | "daily_screenshot_url"
    | "h4_screenshot_url"
    | "h1_screenshot_url"
    | "m15_screenshot_url"
  >,
): MtfScreenshotMap {
  return {
    weekly: session.weekly_screenshot_url,
    daily: session.daily_screenshot_url,
    h4: session.h4_screenshot_url,
    h1: session.h1_screenshot_url,
    m15: session.m15_screenshot_url,
  }
}

export function countMtfScreenshots(screenshots: MtfScreenshotMap): number {
  return MTF_SLOTS.filter((slot) => Boolean(screenshots[slot.id])).length
}

export function getMtfUrlField(timeframe: CoachMtfTimeframe): keyof TradeCoachSessionRecord {
  const slot = MTF_SLOTS.find((item) => item.id === timeframe)
  if (!slot) throw new Error("Invalid timeframe")
  return slot.urlField
}

export function isMtfAnalysisResult(value: unknown): value is MtfAnalysisResult {
  if (!value || typeof value !== "object") return false
  const record = value as MtfAnalysisResult
  return (
    typeof record.overallScore === "number" &&
    !!record.bias &&
    !!record.entry
  )
}

export function resolveSessionMtfAnalysis(
  session: Pick<
    TradeCoachSessionRecord,
    "mtf_analysis" | "planned_context" | "chart_analysis" | "bias_alignment_score" | "entry_confirmation_score" | "vision_score" | "recommendation"
  >,
): MtfAnalysisResult | null {
  const plannedContext = (session.planned_context || {}) as PreTradePlannedContext
  const chartAnalysis = session.chart_analysis as PreTradePlannedContext["chart_analysis"] | null | undefined

  if (isMtfAnalysisResult(session.mtf_analysis)) return session.mtf_analysis as MtfAnalysisResult
  if (isMtfAnalysisResult(plannedContext.mtf_analysis)) return plannedContext.mtf_analysis as MtfAnalysisResult
  if (isMtfAnalysisResult(chartAnalysis?.mtf)) return chartAnalysis?.mtf as MtfAnalysisResult

  if (
    session.bias_alignment_score != null &&
    session.entry_confirmation_score != null &&
    session.vision_score != null
  ) {
    return {
      version: 2,
      bias: {
        weeklyBias: "neutral",
        dailyBias: "neutral",
        h4Bias: "neutral",
        overallBias: "neutral",
        biasAlignmentScore: session.bias_alignment_score,
        biasWarnings: [],
      },
      entry: {
        h1SetupQuality: 50,
        m15EntryQuality: 50,
        entryConfirmationScore: session.entry_confirmation_score,
        entryWarnings: [],
        entryStrengths: [],
      },
      chartsProvided: 0,
      chartsMissing: [],
      confidencePenalty: 0,
      overallScore: session.vision_score,
      visionScore: session.vision_score,
      recommendation: (session.recommendation as MtfAnalysisResult["recommendation"]) || "CAUTION",
      summary: "Chart analysis restored from saved session scores.",
      analyzedAt: new Date().toISOString(),
      visualAnalysis: plannedContext.visual_analysis ?? null,
      provider: plannedContext.visual_analysis?.provider,
    }
  }

  return null
}

export function hasMtfAnalysis(session: TradeCoachSessionWithMessages | TradeCoachSessionRecord): boolean {
  return resolveSessionMtfAnalysis(session) !== null
}

export function mergeMtfIntoContext(
  context: PreTradePlannedContext,
  session: TradeCoachSessionRecord,
  mtfAnalysis?: MtfAnalysisResult | null,
): PreTradePlannedContext {
  const screenshots = getMtfScreenshotsFromSession(session)
  const primaryUrl =
    screenshots.m15 ||
    screenshots.h1 ||
    screenshots.h4 ||
    screenshots.daily ||
    screenshots.weekly ||
    session.screenshot_url ||
    session.chart_url ||
    null

  return {
    ...context,
    chart_url: primaryUrl || undefined,
    screenshot_url: primaryUrl,
    vision_score: mtfAnalysis?.visionScore ?? session.vision_score ?? context.vision_score,
    mtf_analysis: mtfAnalysis ?? resolveSessionMtfAnalysis(session) ?? undefined,
    visual_analysis:
      mtfAnalysis?.visualAnalysis ??
      session.visual_analysis ??
      context.visual_analysis ??
      undefined,
    chart_annotations:
      mtfAnalysis?.visualAnalysis?.chartAnnotations ??
      session.chart_annotations ??
      context.chart_annotations ??
      undefined,
    bias_alignment_score: mtfAnalysis?.bias.biasAlignmentScore ?? session.bias_alignment_score ?? undefined,
    entry_confirmation_score:
      mtfAnalysis?.entry.entryConfirmationScore ?? session.entry_confirmation_score ?? undefined,
  }
}

export function canRunMtfAnalysis(screenshots: MtfScreenshotMap): boolean {
  return countMtfScreenshots(screenshots) > 0
}
