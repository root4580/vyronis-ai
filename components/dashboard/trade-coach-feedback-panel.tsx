"use client"

import { useEffect, useState } from "react"
import { Brain, CheckCircle2, Loader2, RefreshCw, Sparkles, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { fetchCoachFeedback, generateCoachFeedback } from "@/lib/trade-coach/api-client"
import type {
  PostTradeExecutionReview,
  TradeCoachFeedbackRecord,
} from "@/lib/trade-coach/types"
import { cn } from "@/lib/utils"

type TradeCoachFeedbackPanelProps = {
  tradeId: string
  refreshKey?: number
}

type StoredDisciplineAnalysis = TradeCoachFeedbackRecord["discipline_analysis"] & {
  coachingInsights?: string[]
  executionReview?: PostTradeExecutionReview
}

const GRADE_STYLES: Record<string, string> = {
  "A+": "text-profit border-profit/30 bg-profit/[0.1]",
  A: "text-profit border-profit/25 bg-profit/[0.08]",
  B: "text-cyan-glow border-cyan-glow/25 bg-cyan-glow/[0.08]",
  C: "text-warning-foreground border-warning/25 bg-warning/[0.08]",
  D: "text-loss border-loss/25 bg-loss/[0.08]",
}

export function TradeCoachFeedbackPanel({ tradeId, refreshKey = 0 }: TradeCoachFeedbackPanelProps) {
  const [feedback, setFeedback] = useState<TradeCoachFeedbackRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadFeedback() {
      setIsLoading(true)
      setError(null)
      try {
        const existing = await fetchCoachFeedback(tradeId)
        if (!cancelled) setFeedback(existing)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load coach feedback")
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadFeedback()
    return () => {
      cancelled = true
    }
  }, [tradeId, refreshKey])

  async function handleGenerate() {
    setIsGenerating(true)
    setError(null)
    try {
      const generated = await generateCoachFeedback(tradeId)
      setFeedback(generated)
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Could not generate feedback")
    } finally {
      setIsGenerating(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardInsetPanel className="glass flex min-h-[120px] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-cyan-glow" />
      </DashboardInsetPanel>
    )
  }

  if (!feedback) {
    return (
      <DashboardInsetPanel className="glass space-y-3 border-cyan-glow/15 bg-cyan-glow/[0.03]">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-cyan-glow" />
          <p className="text-[11px] font-semibold">Post-trade review</p>
        </div>
        <p className="text-[12px] leading-relaxed text-muted-foreground/80">
          Mentor-style review for this closed trade — strategy quality, discipline, and repeatability.
        </p>
        {error && <p className="text-[11px] text-loss/90">{error}</p>}
        <Button type="button" onClick={() => void handleGenerate()} disabled={isGenerating} className="w-full btn-primary">
          {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
          Generate post-trade review
        </Button>
      </DashboardInsetPanel>
    )
  }

  const discipline = feedback.discipline_analysis as StoredDisciplineAnalysis
  const review = discipline.executionReview
  const comparisons = feedback.planned_vs_actual || []

  return (
    <DashboardInsetPanel className="glass space-y-4 border-cyan-glow/15 bg-cyan-glow/[0.03]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-cyan-glow" />
          <div>
            <p className="text-[11px] font-semibold">Post-trade review</p>
            <p className="text-[10px] text-muted-foreground/70">Completed trade mentor review</p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 border-white/[0.08]"
          onClick={() => void handleGenerate()}
          disabled={isGenerating}
        >
          {isGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        </Button>
      </div>

      {review ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Strategy", grade: review.strategyGrade, score: review.strategyScore },
              { label: "Discipline", grade: review.disciplineGrade, score: review.disciplineScore },
              { label: "Final", grade: review.overallGrade, score: review.finalScore },
            ].map((item) => (
              <div
                key={item.label}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-center",
                  GRADE_STYLES[item.grade] ?? GRADE_STYLES.B,
                )}
              >
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] opacity-75">
                  {item.label}
                </p>
                <p className="text-[22px] font-bold leading-none">{item.grade}</p>
                <p className="mt-1 text-[10px] tabular-nums opacity-80">{item.score}/100</p>
              </div>
            ))}
          </div>
          <Progress value={review.finalScore} className="h-2 bg-white/[0.06]" />

          <div className="rounded-xl border border-cyan-glow/20 bg-cyan-glow/[0.06] px-3 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/80">
              Post-trade verdict
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/90">
              {review.postTradeVerdict}
            </p>
          </div>

          {review.executedWell.length > 0 && (
            <div className="space-y-2">
              <p className="section-label">What went well</p>
              <ul className="space-y-1.5">
                {review.executedWell.map((item) => (
                  <li key={item} className="flex gap-2 text-[11px] leading-relaxed text-foreground/85">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-profit" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {review.ruleGaps.length > 0 && (
            <div className="space-y-2">
              <p className="section-label">Rule gaps</p>
              <ul className="space-y-1.5">
                {review.ruleGaps.map((item) => (
                  <li key={item} className="flex gap-2 text-[11px] leading-relaxed text-warning-foreground">
                    <XCircle className="mt-0.5 size-3.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {review.notVerified.length > 0 && (
            <div className="space-y-2">
              <p className="section-label">Not verified</p>
              <div className="flex flex-wrap gap-1.5">
                {review.notVerified.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] text-muted-foreground/80"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {review.improveNextTime.length > 0 && (
            <div className="rounded-lg border border-cyan-glow/20 bg-cyan-glow/[0.05] px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-cyan-glow/80">
                One improvement next time
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-foreground/85">
                {review.improveNextTime[0]}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
              Repeatability
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-foreground/88">
              {review.repeatable ? (
                <CheckCircle2 className="size-3.5 text-profit" />
              ) : (
                <XCircle className="size-3.5 text-warning-foreground" />
              )}
              {review.repeatable ? "Repeatable with discipline" : "Not yet repeatable"}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/75">
              {review.repeatableReason}
            </p>
          </div>

          <p className="text-[10px] text-muted-foreground/70">{review.riskReward.note}</p>
        </>
      ) : (
        <p className="text-[12px] leading-relaxed text-foreground/90">{feedback.coaching_summary}</p>
      )}

      {comparisons.length > 0 && (
        <div className="space-y-2">
          <p className="section-label">Execution review</p>
          {comparisons.map((item) => (
            <div
              key={item.field}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-[11px]",
                item.aligned
                  ? "border-profit/15 bg-profit/[0.04]"
                  : "border-warning/15 bg-warning/[0.04]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground/85">{item.field}</span>
                <span className={item.aligned ? "text-profit" : "text-warning-foreground"}>
                  {item.aligned ? "Aligned" : "Gap"}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground/75">Plan: {item.planned}</p>
              <p className="text-muted-foreground/75">Actual: {item.actual}</p>
              {item.note ? <p className="mt-1 text-[10px] text-muted-foreground/65">{item.note}</p> : null}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-[11px] text-loss/90">{error}</p>}
    </DashboardInsetPanel>
  )
}
