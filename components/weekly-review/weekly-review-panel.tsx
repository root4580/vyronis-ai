"use client"

import { useCallback, useEffect, useState } from "react"
import { Brain, ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardEmptyState,
} from "@/components/dashboard/dashboard-primitives"
import { WeeklyReviewReportModal } from "@/components/weekly-review/weekly-review-report-modal"
import { WeeklyReviewSummaryCard } from "@/components/weekly-review/weekly-review-summary-card"
import {
  fetchWeeklyReviews,
  generateWeeklyReview,
  previewWeeklyReview,
} from "@/lib/weekly-review/api-client"
import { weeklyReviewRowToReport } from "@/lib/weekly-review/engine"
import type { LeakEngineInput } from "@/lib/behavior"
import type { WeeklyReviewReport } from "@/lib/weekly-review/types"
import { getTradingWeekStartKey } from "@/lib/trading/trading-week"

type WeeklyReviewPanelProps = {
  refreshKey?: number
  onViewTrade?: (tradeId: string) => void
  trades?: LeakEngineInput["trades"]
  maxRiskPerTrade?: number
}

export function WeeklyReviewPanel({
  refreshKey = 0,
  onViewTrade,
  trades = [],
  maxRiskPerTrade = 1,
}: WeeklyReviewPanelProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [report, setReport] = useState<WeeklyReviewReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [persistMessage, setPersistMessage] = useState<string | null>(null)

  const loadReview = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const reviews = await fetchWeeklyReviews(8)
      const match = reviews.find((row) => {
        const preview = previewWeekStart(weekOffset)
        return row.week_start === preview
      })

      if (match) {
        setReport(weeklyReviewRowToReport(match))
      } else {
        const preview = await previewWeeklyReview(weekOffset)
        setReport(preview)
      }
    } catch (loadError) {
      setReport(null)
      setError(loadError instanceof Error ? loadError.message : "Could not load weekly review")
    } finally {
      setIsLoading(false)
    }
  }, [weekOffset])

  useEffect(() => {
    void loadReview()
  }, [loadReview, refreshKey])

  async function handleGenerate() {
    setIsGenerating(true)
    setError(null)
    setPersistMessage(null)
    try {
      const result = await generateWeeklyReview(weekOffset, false)
      setReport(result.report)
      if (result.skipped) {
        setPersistMessage("Review generated on this device. Cloud save is not configured yet.")
      } else if (result.persisted) {
        setPersistMessage("Weekly review saved to your Vyronis journal.")
      }
      setModalOpen(true)
    } catch (generateError) {
      setError(
        generateError instanceof Error ? generateError.message : "Failed to generate weekly review",
      )
    } finally {
      setIsGenerating(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardCard className="glass-card floating-glow" glow>
        <DashboardCardBody className="flex min-h-[220px] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-cyan-glow" />
        </DashboardCardBody>
      </DashboardCard>
    )
  }

  return (
    <>
      <DashboardCard className="glass-card floating-glow weekly-review-fade-in" glow interactive>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-violet-500/[0.06] via-cyan-glow/[0.04] to-transparent" />
        <p className="px-4 pt-3 text-[11px] leading-relaxed text-muted-foreground/70 md:px-6">
          Discipline and behavior scores for the week. For trade-level coach grades and P&amp;L, open Journal →
          Weekly debrief.
        </p>
        <DashboardCardHeader
          title="Weekly Behavioral Review"
          icon={Brain}
          action={
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => setWeekOffset((current) => current + 1)}
                aria-label="Previous week"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={weekOffset <= 0}
                onClick={() => setWeekOffset((current) => Math.max(0, current - 1))}
                aria-label="Next week"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          }
        />
        <DashboardCardBody className="space-y-4">
          {error ? (
            <DashboardEmptyState
              icon={Brain}
              title="Weekly review unavailable"
              description={error}
              className="min-h-[160px]"
            />
          ) : (
            <>
              <WeeklyReviewSummaryCard
                report={report}
                isGenerating={isGenerating}
                onGenerate={() => void handleGenerate()}
                onOpenReport={() => setModalOpen(true)}
              />

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={isGenerating}
                  className="btn-primary flex-1"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Generating Weekly Review…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 size-4" />
                      Generate Weekly Review
                    </>
                  )}
                </Button>
                {report?.hasData && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setModalOpen(true)}
                  >
                    View report
                  </Button>
                )}
              </div>

              {persistMessage && (
                <p className="text-center text-[11px] text-cyan-glow/80">{persistMessage}</p>
              )}
            </>
          )}
        </DashboardCardBody>
      </DashboardCard>

      <WeeklyReviewReportModal
        report={report}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onViewTrade={onViewTrade}
        trades={trades}
        maxRiskPerTrade={maxRiskPerTrade}
      />
    </>
  )
}

function previewWeekStart(weekOffset: number): string {
  return getTradingWeekStartKey(new Date(), weekOffset)
}
