"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, ChevronRight, Loader2 } from "lucide-react"
import { fetchWeeklyChapterDashboard } from "@/lib/weekly-chapters/api-client"
import type { WeeklySummaryRecord } from "@/lib/weekly-chapters/types"
import { formatWeekOfLabel } from "@/lib/weekly-chapters/week-utils"
import {
  formatWeeklyPaperSummaryLine,
  readWeeklySummaryPaperStats,
} from "@/lib/weekly-chapters/paper-stats"
import { getChapterReviewHref } from "@/lib/dashboard-nav"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { cn } from "@/lib/utils"

type ChapterTimelinePanelProps = {
  accountId: string | null
}

export function ChapterTimelinePanel({ accountId }: ChapterTimelinePanelProps) {
  const router = useRouter()
  const [timeline, setTimeline] = useState<WeeklySummaryRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [migrationPending, setMigrationPending] = useState(false)

  useEffect(() => {
    if (!accountId) {
      setTimeline([])
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    void fetchWeeklyChapterDashboard({ accountId })
      .then((payload) => {
        if (cancelled) return
        setTimeline(payload.timeline ?? [])
        setMigrationPending(Boolean(payload.migrationPending))
      })
      .catch(() => {
        if (!cancelled) setTimeline([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accountId])

  if (isLoading) {
    return (
      <DashboardInsetPanel className="flex min-h-[140px] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-cyan-glow/80" />
      </DashboardInsetPanel>
    )
  }

  if (migrationPending) {
    return (
      <DashboardInsetPanel className="text-[12px] text-text-muted">
        Run <code className="text-text-secondary">supabase/038-weekly-chapters.sql</code> to unlock your
        trading story timeline.
      </DashboardInsetPanel>
    )
  }

  if (timeline.length === 0) {
    return (
      <DashboardInsetPanel className="py-8 text-center text-[12px] text-text-muted">
        Your chapter timeline will fill in as each week closes. Past chapters are remembered, not erased.
      </DashboardInsetPanel>
    )
  }

  return (
    <div className="relative space-y-0 pl-4">
      <div
        className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-cyan-glow/40 via-white/10 to-transparent"
        aria-hidden
      />
      {timeline.map((chapter) => {
        const positive = chapter.is_winning_chapter
        const paperLine = formatWeeklyPaperSummaryLine(readWeeklySummaryPaperStats(chapter))
        return (
          <div key={chapter.id} className="relative pb-4 last:pb-0">
            <span
              className={cn(
                "absolute -left-4 top-3 size-3.5 rounded-full border-2 bg-[var(--surface-page)]",
                positive ? "border-profit bg-profit/20" : "border-loss/50 bg-loss/10",
              )}
              aria-hidden
            />
            <button
              type="button"
              onClick={() => router.push(getChapterReviewHref(chapter.week_start))}
              className={cn(
                "w-full rounded-[var(--radius-md)] border px-3 py-3 text-left transition-colors hover:bg-white/[0.02]",
                positive ? "border-profit/20" : "border-loss/20",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <BookOpen className="size-3.5 text-cyan-glow/80" />
                    <p className="text-[12px] font-medium text-text-primary">
                      Chapter {chapter.chapter_number}
                    </p>
                    <span
                      className={cn(
                        "rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                        positive ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
                      )}
                    >
                      {positive ? "Green week" : "Red week"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-text-muted">
                    {formatWeekOfLabel(chapter.week_start)} · {chapter.trades_taken} live ·{" "}
                    {chapter.win_rate}% win
                  </p>
                  {paperLine ? (
                    <p className="mt-0.5 text-[10px] text-text-muted">📝 {paperLine}</p>
                  ) : null}
                  {chapter.key_lesson ? (
                    <p className="mt-1 line-clamp-2 text-[10px] italic text-text-secondary">
                      “{chapter.key_lesson}”
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      "text-[13px] font-semibold tabular-nums",
                      getPnLTextClass(chapter.pnl, chapter.pnl >= 0 ? "WIN" : "LOSS"),
                    )}
                  >
                    {formatPnL(chapter.pnl, chapter.pnl >= 0 ? "WIN" : "LOSS")}
                  </span>
                  <ChevronRight className="size-4 text-text-muted" />
                </div>
              </div>
            </button>
          </div>
        )
      })}
    </div>
  )
}
