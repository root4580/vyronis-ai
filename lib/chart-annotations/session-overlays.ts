import { MTF_SLOTS, type CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import { buildTimeframeChartUnderstanding } from "@/lib/chart-annotations/annotation-engine"
import type { ChartAnnotation, ChartAnnotationBundle } from "@/lib/chart-annotations/types"
import type { MtfAnalysisResult } from "@/lib/coach/mtf-types"
import type { TimeframeVisualAnalysis } from "@/lib/coach/visual-analysis-types"
import { getMtfScreenshotsFromSession } from "@/lib/trade-coach/mtf-session"
import type {
  PreTradePlannedContext,
  TradeCoachSessionWithMessages,
} from "@/lib/trade-coach/types"

export type SessionChartCard = {
  timeframe: CoachMtfTimeframe
  label: string
  shortLabel: string
  url: string
  annotations: ChartAnnotation[]
  strategyMatchPercent?: number
}

function resolveAnnotationBundle(
  session: TradeCoachSessionWithMessages | null | undefined,
  analysis: MtfAnalysisResult | null | undefined,
): ChartAnnotationBundle | null {
  return (
    analysis?.visualAnalysis?.chartAnnotations ||
    session?.chart_annotations ||
    session?.planned_context?.chart_annotations ||
    null
  )
}

function resolveTimeframeAnalysis(
  timeframe: CoachMtfTimeframe,
  session: TradeCoachSessionWithMessages | null | undefined,
  analysis: MtfAnalysisResult | null | undefined,
): TimeframeVisualAnalysis | null {
  const fromVisual =
    analysis?.visualAnalysis?.timeframes?.[timeframe] ||
    session?.planned_context?.visual_analysis?.timeframes?.[timeframe] ||
    session?.visual_analysis?.timeframes?.[timeframe]

  if (!fromVisual) return null
  return fromVisual
}

export function resolveSessionChartCards(input: {
  session: TradeCoachSessionWithMessages | null | undefined
  analysis: MtfAnalysisResult | null | undefined
}): SessionChartCard[] {
  const { session, analysis } = input
  if (!session) return []

  const screenshots = getMtfScreenshotsFromSession(session)
  const context = (session.planned_context || {}) as PreTradePlannedContext
  const bundle = resolveAnnotationBundle(session, analysis)
  const allTimeframes =
    analysis?.visualAnalysis?.timeframes ||
    session?.planned_context?.visual_analysis?.timeframes ||
    session?.visual_analysis?.timeframes ||
    {}
  const strategyMatch =
    analysis?.visualAnalysis?.playbookComparison?.matchScore ||
    bundle?.confidenceBreakdown?.weightedScore ||
    bundle?.timeframes?.h1?.strategyMatchPercent ||
    context.playbook_match?.matchScore

  return MTF_SLOTS.filter((slot) => screenshots[slot.id]).map((slot) => {
    const stored =
      bundle?.timeframes?.[slot.id]?.annotations ||
      analysis?.visualAnalysis?.timeframes?.[slot.id]?.annotations ||
      session.planned_context?.visual_analysis?.timeframes?.[slot.id]?.annotations

    let annotations = stored || []
    if (annotations.length === 0) {
      const tfAnalysis = resolveTimeframeAnalysis(slot.id, session, analysis)
      if (tfAnalysis) {
        annotations = buildTimeframeChartUnderstanding({
          timeframe: slot.id,
          analysis: tfAnalysis,
          context,
          strategyMatchPercent: strategyMatch,
          allTimeframes,
          provider: tfAnalysis.provider,
        }).annotations
      }
    }

    return {
      timeframe: slot.id,
      label: slot.label,
      shortLabel: slot.shortLabel,
      url: screenshots[slot.id]!,
      annotations,
      strategyMatchPercent: bundle?.timeframes?.[slot.id]?.strategyMatchPercent ?? strategyMatch,
    }
  })
}

export function resolveChartAnnotationsForTimeframe(input: {
  session: TradeCoachSessionWithMessages | null | undefined
  analysis: MtfAnalysisResult | null | undefined
  timeframe: CoachMtfTimeframe
}): ChartAnnotation[] {
  const card = resolveSessionChartCards({
    session: input.session,
    analysis: input.analysis,
  }).find((item) => item.timeframe === input.timeframe)
  return card?.annotations || []
}
