import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import { ENTRY_TIMEFRAMES } from "@/lib/coach/mtf-constants"
import type {
  ChartAnnotation,
  ChartAnnotationBundle,
  OpenAiChartAnnotationPayload,
  TimeframeChartUnderstanding,
  VisualMistakeKind,
  VisualMistakePattern,
} from "@/lib/chart-annotations/types"
import { TOP_DOWN_INFERENCE_LEGEND as LEGEND } from "@/lib/chart-annotations/types"
import {
  buildTopDownStackContext,
  inferTopDownHeuristicAnnotations,
  mergeTopDownAnnotations,
  parseTopDownGptAnnotations,
  scoreTopDownConfidence,
} from "@/lib/chart-annotations/top-down-overlay-engine"
import type { TimeframeVisualAnalysis, VisualAnalysisResult } from "@/lib/coach/visual-analysis-types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function resolveGptRawAnnotations(
  analysis: TimeframeVisualAnalysis,
): OpenAiChartAnnotationPayload[] | undefined {
  if (analysis.gptAnnotations?.length) return analysis.gptAnnotations
  const legacy = analysis.annotations
  if (!legacy?.length) return undefined
  if (legacy.some((item) => "source" in item && item.source)) return undefined
  return legacy as unknown as OpenAiChartAnnotationPayload[]
}

export function buildTimeframeChartUnderstanding(input: {
  timeframe: CoachMtfTimeframe
  analysis: TimeframeVisualAnalysis
  context: PreTradePlannedContext
  strategyMatchPercent?: number
  allTimeframes?: Partial<Record<CoachMtfTimeframe, TimeframeVisualAnalysis>>
  provider?: string
}): TimeframeChartUnderstanding {
  const { analysis, context, timeframe } = input
  const allTimeframes = input.allTimeframes || { [timeframe]: analysis }
  const stack = buildTopDownStackContext({ timeframes: allTimeframes, context })
  const confidenceBreakdown = scoreTopDownConfidence({ stack, timeframes: allTimeframes })

  const gptRaw = resolveGptRawAnnotations(analysis)
  const gptAnnotations = parseTopDownGptAnnotations(gptRaw, timeframe, stack)
  const heuristicAnnotations = inferTopDownHeuristicAnnotations({
    timeframe,
    analysis,
    stack,
    context,
  })
  const merged = mergeTopDownAnnotations({
    gptAnnotations,
    heuristicAnnotations,
    provider: input.provider || analysis.provider,
  })

  const gptCount = merged.filter((a) => a.source === "gpt4_vision").length
  const inferenceSource =
    gptCount === 0 ? "heuristic" : gptCount === merged.length ? "gpt4_vision" : "mixed"

  let riskExplanation = analysis.riskExplanation || analysis.warnings[0]
  if (stack.countertrendSetup) {
    riskExplanation = "Countertrend vs HTF bias — penalized under Top-Down AOI rules."
  } else if (stack.h1Choppy && timeframe === "h1") {
    riskExplanation = "Messy/choppy H1 structure — wait for clean pullback into AOI."
  } else if (!stack.m15Confirmed && timeframe === "m15") {
    riskExplanation = "No M15 confirmation candle close — early entry risk."
  } else if (stack.m15EarlyOrChase) {
    riskExplanation = "Overextended/chase entry detected — displacement or FOMO risk."
  }

  let setupGradeReason =
    analysis.setupGradeReason ||
    analysis.strengths[0] ||
    "Top-Down AOI read from chart structure."

  if (confidenceBreakdown.weightedScore >= 78 && stack.m15Confirmed && stack.h4ConfirmsHtf) {
    setupGradeReason = "A+ candidate: HTF aligned, H4 confirms, clean H1, M15 close confirmed."
  }

  return {
    timeframe,
    bias: analysis.htfTrendBias,
    structureQuality: analysis.structureQuality ?? confidenceBreakdown.h4StructureScore,
    setupQuality: analysis.entryQuality,
    aoiDescriptions: analysis.supplyDemandZones.filter(Boolean),
    liquidityDetected: analysis.liquiditySweepDetected,
    confirmationDetected: stack.m15Confirmed,
    countertrend: stack.countertrendSetup,
    overextended: analysis.overextended ?? stack.m15EarlyOrChase,
    rrEstimate: analysis.rrQuality,
    strategyMatchPercent: input.strategyMatchPercent ?? confidenceBreakdown.weightedScore,
    riskExplanation,
    setupGradeReason,
    annotations: merged,
    confidenceBreakdown,
    inferenceSource,
  }
}

export function buildChartAnnotationBundle(input: {
  visualAnalysis: VisualAnalysisResult
  context: PreTradePlannedContext
}): ChartAnnotationBundle {
  const timeframes: ChartAnnotationBundle["timeframes"] = {}
  const allTimeframes = input.visualAnalysis.timeframes
  const stack = buildTopDownStackContext({ timeframes: allTimeframes, context: input.context })
  const confidenceBreakdown = scoreTopDownConfidence({ stack, timeframes: allTimeframes })

  for (const [tf, analysis] of Object.entries(allTimeframes)) {
    if (!analysis) continue
    timeframes[tf as CoachMtfTimeframe] = buildTimeframeChartUnderstanding({
      timeframe: tf as CoachMtfTimeframe,
      analysis,
      context: input.context,
      strategyMatchPercent:
        input.visualAnalysis.playbookComparison?.matchScore ?? confidenceBreakdown.weightedScore,
      allTimeframes,
      provider: input.visualAnalysis.provider,
    })
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    provider: input.visualAnalysis.provider,
    confidenceBreakdown,
    inferenceLegend: {
      gpt4Vision: [...LEGEND.gpt4Vision],
      heuristic: [...LEGEND.heuristic],
    },
    timeframes,
  }
}

export function getAnnotationsForTimeframe(
  bundle: ChartAnnotationBundle | null | undefined,
  timeframe: CoachMtfTimeframe,
): ChartAnnotation[] {
  return bundle?.timeframes?.[timeframe]?.annotations || []
}

const MISTAKE_LABELS: Record<VisualMistakeKind, string> = {
  early_entry: "Early entries before M15 confirmation close",
  chasing_candle: "Chasing displacement/expansion candles",
  weak_m15_confirmation: "Weak or missing M15 confirmation close",
  no_aoi: "No valid AOI from BOS/supply-demand",
  htf_conflict: "H4 vs Weekly/Daily HTF conflict",
  emotional_entry: "Emotional entries",
  expansion_entry: "Entries after expansion moves",
  countertrend: "Countertrend vs HTF bias",
}

export function detectVisualMistakesFromUnderstanding(
  understanding: TimeframeChartUnderstanding | undefined,
): VisualMistakeKind[] {
  if (!understanding) return []
  const mistakes: VisualMistakeKind[] = []
  if (understanding.countertrend) mistakes.push("countertrend")
  if (understanding.overextended) mistakes.push("expansion_entry")
  if (!understanding.confirmationDetected && ENTRY_TIMEFRAMES.includes(understanding.timeframe)) {
    mistakes.push("weak_m15_confirmation")
  }
  if (
    understanding.annotations.some((item) => item.kind === "aoi_invalid") &&
    !understanding.annotations.some((item) => item.kind === "aoi_valid")
  ) {
    mistakes.push("no_aoi")
  }
  if (understanding.annotations.some((item) => item.kind === "chase_risk" || item.kind === "displacement")) {
    mistakes.push("chasing_candle")
  }
  if (understanding.annotations.some((item) => item.kind === "countertrend")) {
    mistakes.push("early_entry")
  }
  if (understanding.riskExplanation?.includes("H4 disagrees")) {
    mistakes.push("htf_conflict")
  }
  return mistakes
}

export function aggregateVisualMistakePatterns(
  bundles: Array<{ bundle?: ChartAnnotationBundle | null; emotion?: string | null }>,
): VisualMistakePattern[] {
  const counts = new Map<VisualMistakeKind, number>()

  for (const item of bundles) {
    if (!item.bundle) continue
    for (const understanding of Object.values(item.bundle.timeframes)) {
      if (!understanding) continue
      for (const mistake of detectVisualMistakesFromUnderstanding(understanding)) {
        counts.set(mistake, (counts.get(mistake) || 0) + 1)
      }
    }
    if (item.emotion && /fomo|revenge|euphoric|greed|anxious/i.test(item.emotion)) {
      counts.set("emotional_entry", (counts.get("emotional_entry") || 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([kind, count]) => ({
      kind,
      count,
      label: MISTAKE_LABELS[kind],
      message: `${MISTAKE_LABELS[kind]} (${count}x)`,
    }))
    .sort((a, b) => b.count - a.count)
}

export function topVisualMistakeMessage(patterns: VisualMistakePattern[]): string | null {
  if (patterns.length === 0) return null
  return `Most common visual mistake: ${patterns[0].label.toLowerCase()}.`
}

export { LEGEND as TOP_DOWN_INFERENCE_LEGEND }
