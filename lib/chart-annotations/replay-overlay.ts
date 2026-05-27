import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import type {
  ChartAnnotation,
  ChartAnnotationBundle,
  ReplayOverlayMoment,
} from "@/lib/chart-annotations/types"
import type { ExecutionReplayPhase, ExecutionReplayScreenshot } from "@/lib/replay/types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

const PHASE_REPLAY_MOMENT: Partial<Record<ExecutionReplayPhase, ReplayOverlayMoment>> = {
  pre_trade_plan: "before_entry",
  ai_analysis: "before_entry",
  entry_execution: "entry",
  emotion_drift: "mistake",
  rule_violations: "mistake",
  trade_close: "exit",
  ai_debrief: "exit",
}

export function resolveReplayMomentForPhase(
  phase: ExecutionReplayPhase,
): ReplayOverlayMoment | undefined {
  return PHASE_REPLAY_MOMENT[phase]
}

export function filterAnnotationsForReplay(
  annotations: ChartAnnotation[],
  moment?: ReplayOverlayMoment,
): ChartAnnotation[] {
  if (!moment) return annotations
  const filtered = annotations.filter((item) => !item.replayMoment || item.replayMoment === moment)
  return filtered.length > 0 ? filtered : annotations
}

export function attachAnnotationsToReplayScreenshot(input: {
  screenshot: ExecutionReplayScreenshot
  bundle: ChartAnnotationBundle | null | undefined
  phase: ExecutionReplayPhase
  commentary?: string[]
}): ExecutionReplayScreenshot {
  const timeframe = input.screenshot.timeframe
  const understanding = timeframe ? input.bundle?.timeframes?.[timeframe] : undefined
  const moment = resolveReplayMomentForPhase(input.phase)
  const annotations = filterAnnotationsForReplay(understanding?.annotations || [], moment)

  return {
    ...input.screenshot,
    annotations,
    replayMoment: moment,
    overlayCommentary: [
      ...(input.commentary || []),
      ...(understanding?.riskExplanation ? [understanding.riskExplanation] : []),
      ...(annotations
        .map((item) => item.commentary)
        .filter(Boolean) as string[]),
    ].slice(0, 4),
  }
}

export function resolveChartAnnotationBundle(
  context: PreTradePlannedContext | null | undefined,
): ChartAnnotationBundle | null {
  const bundle = context?.chart_annotations
  if (bundle && bundle.version === 1 && bundle.timeframes) return bundle
  return null
}

export function getTimeframeUnderstanding(
  bundle: ChartAnnotationBundle | null | undefined,
  timeframe: CoachMtfTimeframe,
) {
  return bundle?.timeframes?.[timeframe]
}
