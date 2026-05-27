"use client"

import { useEffect, useState } from "react"
import { Brain, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { fetchCoachFeedback, generateCoachFeedback } from "@/lib/trade-coach/api-client"
import type { TradeCoachFeedbackRecord } from "@/lib/trade-coach/types"
import { cn } from "@/lib/utils"

type TradeCoachFeedbackPanelProps = {
  tradeId: string
  refreshKey?: number
}

type DisciplineAnalysisWithInsights = TradeCoachFeedbackRecord["discipline_analysis"] & {
  coachingInsights?: string[]
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Coach Review</p>
        </div>
        <p className="text-[12px] leading-relaxed text-muted-foreground/80">
          Generate a plan vs outcome review and discipline analysis for this trade.
        </p>
        {error && <p className="text-[11px] text-loss/90">{error}</p>}
        <Button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-cyan-glow to-cyan-glow/80 text-background"
        >
          {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
          Generate Coach Review
        </Button>
      </DashboardInsetPanel>
    )
  }

  const discipline = feedback.discipline_analysis as DisciplineAnalysisWithInsights
  const coachingInsights =
    discipline.coachingInsights?.length
      ? discipline.coachingInsights
      : feedback.feedback_points?.slice(0, 4) ?? []
  const comparisons = feedback.planned_vs_actual || []

  return (
    <DashboardInsetPanel className="glass space-y-3 border-cyan-glow/15 bg-cyan-glow/[0.03]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-cyan-glow" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Coach Review</p>
            <p className="text-[10px] text-muted-foreground/70">Plan vs outcome analysis</p>
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

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/70">Discipline Score</span>
          <span
            className={cn(
              "text-xl font-bold tabular-nums",
              feedback.discipline_score >= 75
                ? "text-profit"
                : feedback.discipline_score >= 50
                  ? "text-amber-400"
                  : "text-loss",
            )}
          >
            {feedback.discipline_score}
          </span>
        </div>
        <Progress value={feedback.discipline_score} className="h-2 bg-white/[0.06]" />
      </div>

      <p className="text-[12px] leading-relaxed text-foreground/90">{feedback.coaching_summary}</p>

      {coachingInsights.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            Coaching Insights
          </p>
          <div className="flex flex-wrap gap-1.5">
            {coachingInsights.map((insight) => (
              <span
                key={insight}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-medium",
                  insight.includes("broke") || insight.includes("FOMO") || insight.includes("Revenge") || insight.includes("Euphoric")
                    ? "border-amber-500/25 bg-amber-500/[0.08] text-amber-300"
                    : "border-profit/20 bg-profit/[0.06] text-profit/90",
                )}
              >
                {insight}
              </span>
            ))}
          </div>
        </div>
      )}

      {comparisons.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            Planned vs Actual
          </p>
          {comparisons.map((item) => (
            <div
              key={item.field}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-[11px]",
                item.aligned
                  ? "border-profit/15 bg-profit/[0.04]"
                  : "border-amber-500/15 bg-amber-500/[0.04]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground/85">{item.field}</span>
                <span className={item.aligned ? "text-profit" : "text-amber-400"}>
                  {item.aligned ? "Aligned" : "Gap"}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground/75">Plan: {item.planned}</p>
              <p className="text-muted-foreground/75">Actual: {item.actual}</p>
              {item.note && (
                <p className="mt-1 text-[10px] text-muted-foreground/65">{item.note}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {feedback.feedback_points?.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            Coaching Points
          </p>
          <ul className="space-y-1.5">
            {feedback.feedback_points.map((point, index) => (
              <li key={`${point}-${index}`} className="text-[11px] leading-relaxed text-muted-foreground/85">
                • {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {discipline && (
        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground/75">
          <div>Rule adherence: {discipline.ruleAdherence}</div>
          <div>Emotional control: {discipline.emotionalControl}</div>
        </div>
      )}

      {error && <p className="text-[11px] text-loss/90">{error}</p>}
    </DashboardInsetPanel>
  )
}
