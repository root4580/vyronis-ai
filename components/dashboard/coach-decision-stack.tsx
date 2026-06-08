"use client"

import { CoachChartOverlayStrip } from "@/components/chart-annotations/coach-chart-overlay-strip"
import { CoachAiExplanationSection } from "@/components/dashboard/coach-ai-explanation-section"
import { CoachDecisionPanel } from "@/components/dashboard/coach-decision-panel"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import type { CoachExecutionVerdict } from "@/lib/coach/coach-execution-verdict"
import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import type { MtfAnalysisResult } from "@/lib/coach/mtf-types"
import type { VyronisCoachResponse } from "@/lib/coach/vyronis-coach-response"
import type { ChartAnnotation } from "@/lib/chart-annotations/types"
import type {
  PreTradePlannedContext,
  TradeCoachSessionWithMessages,
} from "@/lib/trade-coach/types"

type CoachDecisionStackProps = {
  verdict: CoachExecutionVerdict
  session?: TradeCoachSessionWithMessages | null
  mtf?: MtfAnalysisResult | null
  context?: PreTradePlannedContext | null
  vyronisCoach?: VyronisCoachResponse | null
  chartsCompact?: boolean
  onOpenChart?: (input: {
    url: string
    title: string
    timeframe: CoachMtfTimeframe
    annotations: ChartAnnotation[]
  }) => void
}

export function CoachDecisionStack({
  verdict,
  session,
  mtf,
  context,
  vyronisCoach,
  chartsCompact = false,
  onOpenChart,
}: CoachDecisionStackProps) {
  return (
    <>
      <DashboardInsetPanel className="border-cyan-glow/25 bg-cyan-glow/[0.05] px-3 py-3">
        <CoachDecisionPanel
          verdict={verdict}
          mtf={mtf}
          context={context}
          vyronisCoach={vyronisCoach}
        />
      </DashboardInsetPanel>

      {mtf && session ? (
        <CoachChartOverlayStrip
          session={session}
          analysis={mtf}
          compact={chartsCompact}
          title="Chart Gallery"
          onOpenChart={onOpenChart}
        />
      ) : null}

      <CoachAiExplanationSection
        verdict={verdict}
        mtf={mtf}
        context={context}
        vyronisCoach={vyronisCoach}
      />
    </>
  )
}
