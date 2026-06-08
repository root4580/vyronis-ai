"use client"

import { useMemo } from "react"
import { Sparkles } from "lucide-react"
import { CoachCollapsibleSection } from "@/components/dashboard/coach-collapsible-section"
import type { CoachExecutionVerdict } from "@/lib/coach/coach-execution-verdict"
import { buildCoachDecisionView } from "@/lib/coach/coach-decision-view"
import type { MtfAnalysisResult } from "@/lib/coach/mtf-types"
import type { VyronisCoachResponse } from "@/lib/coach/vyronis-coach-response"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

type CoachAiExplanationSectionProps = {
  verdict: CoachExecutionVerdict
  mtf?: MtfAnalysisResult | null
  context?: PreTradePlannedContext | null
  vyronisCoach?: VyronisCoachResponse | null
}

export function CoachAiExplanationSection({
  verdict,
  mtf,
  context,
  vyronisCoach,
}: CoachAiExplanationSectionProps) {
  const explanation = useMemo(
    () =>
      buildCoachDecisionView({
        verdict,
        mtf,
        context,
        vyronisCoach,
      }).aiExplanation,
    [verdict, mtf, context, vyronisCoach],
  )

  const hasContent = Boolean(
    explanation.summary ||
      explanation.warnings.length > 0 ||
      explanation.journalNote ||
      explanation.oneImprovement,
  )

  if (!hasContent) return null

  const subtitle = explanation.summary
    ? explanation.summary.slice(0, 72) + (explanation.summary.length > 72 ? "…" : "")
    : "Coach narrative and journal notes"

  return (
    <CoachCollapsibleSection title="AI Explanation" subtitle={subtitle}>
      <div className="space-y-3">
        {explanation.summary ? (
          <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/65">
              <Sparkles className="size-3" />
              Coach narrative
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/88">
              {explanation.summary}
            </p>
          </div>
        ) : null}
        {explanation.warnings.length > 0 ? (
          <ul className="space-y-1">
            {explanation.warnings.map((warning) => (
              <li
                key={warning}
                className="text-[11px] leading-relaxed text-warning-foreground/90 before:mr-1.5 before:content-['·']"
              >
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
        {explanation.journalNote ? (
          <p className="text-[11px] leading-relaxed text-foreground/85">{explanation.journalNote}</p>
        ) : null}
        {explanation.oneImprovement ? (
          <p className="text-[11px] leading-relaxed text-foreground/85">
            <span className="font-semibold">One improvement:</span> {explanation.oneImprovement}
          </p>
        ) : null}
      </div>
    </CoachCollapsibleSection>
  )
}
