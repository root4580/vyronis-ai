"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  Brain,
  CalendarRange,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { WeeklyReviewInsightCard } from "@/components/weekly-review/weekly-review-insight-card"
import { WeeklyReviewScoreMeter } from "@/components/weekly-review/weekly-review-score-meter"
import type { LeakEngineInput } from "@/lib/behavior"
import type { WeeklyReviewReport } from "@/lib/weekly-review/types"
import {
  buildBehavioralExportSummary,
  printBehavioralWeeklyReview,
} from "@/lib/weekly-review/behavioral-export"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import { cn } from "@/lib/utils"

type WeeklyReviewReportModalProps = {
  report: WeeklyReviewReport | null
  open: boolean
  onClose: () => void
  onViewTrade?: (tradeId: string) => void
  trades?: LeakEngineInput["trades"]
  maxRiskPerTrade?: number
}

const ANIMATION_MS = 300

export function WeeklyReviewReportModal({
  report,
  open,
  onClose,
  onViewTrade,
  trades = [],
  maxRiskPerTrade = 1,
}: WeeklyReviewReportModalProps) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(open)

  const handleClose = useCallback(() => onClose(), [onClose])

  useEffect(() => {
    if (open) {
      setMounted(true)
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }
    setVisible(false)
    const timer = window.setTimeout(() => setMounted(false), ANIMATION_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!mounted) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [mounted, handleClose])

  if (!mounted || !report) return null

  const pnlTone = report.totalPnL >= 0 ? "WIN" : "LOSS"

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{ transition: `opacity ${ANIMATION_MS}ms ease` }}
      role="dialog"
      aria-modal="true"
      aria-label="Weekly AI review report"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
        aria-label="Close weekly review"
      />

      <div
        className={cn(
          "weekly-review-terminal relative flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-cyan-glow/20 sm:rounded-2xl",
          visible ? "translate-y-0 scale-100" : "translate-y-4 scale-[0.98]",
        )}
        style={{ transition: `transform ${ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="weekly-review-terminal-scan pointer-events-none absolute inset-0" />

        <header className="relative shrink-0 border-b border-cyan-glow/15 px-4 py-4 md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg border border-cyan-glow/25 bg-cyan-glow/[0.1]">
                  <Brain className="size-4 text-cyan-glow" />
                </div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-glow/90">
                  Vyronis AI · Weekly Review
                </p>
                <Badge variant="outline" className="h-5 border-cyan-glow/25 text-[10px] text-cyan-glow">
                  {report.provider}
                </Badge>
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">
                Performance & Psychology Report
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/75">
                <CalendarRange className="size-3.5" />
                {report.weekLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-white/[0.1] text-[11px]"
                onClick={() => {
                  const summary = buildBehavioralExportSummary(report, trades, maxRiskPerTrade)
                  printBehavioralWeeklyReview(report, summary)
                }}
              >
                Print review
              </Button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 hover:border-white/[0.14]"
                aria-label="Close"
              >
                <X className="size-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <div className="font-mono text-[11px] text-cyan-glow/70">
            <span className="text-profit">&gt;</span> analyzing journal stream… complete
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{report.headline}</p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2">
              <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60">Trades</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">{report.tradeCount}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2">
              <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60">Win Rate</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-cyan-glow">{report.winRate}%</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2">
              <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60">P&L</p>
              <p className={cn("mt-0.5 text-lg font-bold tabular-nums", getPnLTextClass(report.totalPnL, pnlTone))}>
                {formatPnL(report.totalPnL, pnlTone)}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2">
              <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60">Overall</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-cyan-glow">
                {report.scores.overall}/100
              </p>
            </div>
          </div>

          <section className="mt-6">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">
              Weekly Grades
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <WeeklyReviewScoreMeter label="Discipline" score={report.scores.discipline} delayMs={80} />
              <WeeklyReviewScoreMeter
                label="Emotional Stability"
                score={report.scores.emotionalStability}
                delayMs={140}
              />
              <WeeklyReviewScoreMeter label="Execution" score={report.scores.execution} delayMs={200} />
              <WeeklyReviewScoreMeter label="Consistency" score={report.scores.consistency} delayMs={260} />
            </div>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/[0.08] bg-black/25 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                Behavioral Scan
              </p>
              <ul className="mt-2 space-y-2 text-[11px] text-foreground/85">
                <li className="flex items-start gap-2">
                  <AlertTriangle
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      report.behavioralFlags.fomo.detected ? "text-orange-400" : "text-muted-foreground/40",
                    )}
                  />
                  FOMO: {report.behavioralFlags.fomo.message ?? "Not detected"}
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      report.behavioralFlags.revenge.detected ? "text-loss" : "text-muted-foreground/40",
                    )}
                  />
                  Revenge: {report.behavioralFlags.revenge.message ?? "Not detected"}
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="mt-0.5 size-3.5 shrink-0 text-violet-300" />
                  Session edge: {report.strongestSession ?? "—"}
                </li>
                <li className="flex items-start gap-2">
                  <Target className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
                  Weakest habit: {report.weakestHabit ?? "—"}
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-black/25 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                Setup & Mistake Intel
              </p>
              <div className="mt-2 space-y-2">
                {report.bestSetupTypes.length > 0 ? (
                  report.bestSetupTypes.map((setup) => (
                    <Badge
                      key={setup}
                      variant="outline"
                      className="mr-1 border-profit/25 bg-profit/[0.06] text-profit"
                    >
                      {setup}
                    </Badge>
                  ))
                ) : (
                  <p className="text-[11px] text-muted-foreground/70">No setup edge identified.</p>
                )}
                {report.recurringMistakes.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-loss/80">Recurring mistakes</p>
                    {report.recurringMistakes.map((mistake) => (
                      <p key={mistake} className="mt-1 text-[11px] text-foreground/85">
                        · {mistake}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {report.insights.length > 0 && (
            <section className="mt-6">
              <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">
                <Sparkles className="size-3.5" />
                AI Insight Stream
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {report.insights.map((insight) => (
                  <WeeklyReviewInsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            </section>
          )}

          {report.improvementPlan.length > 0 && (
            <section className="mt-6 rounded-xl border border-cyan-glow/20 bg-cyan-glow/[0.04] p-4">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow">
                <TrendingUp className="size-3.5" />
                Next Week Improvement Plan
              </p>
              <ol className="mt-3 space-y-2">
                {report.improvementPlan.map((step, index) => (
                  <li
                    key={step}
                    className="flex gap-2 text-[12px] leading-relaxed text-foreground/90"
                  >
                    <span className="font-mono text-cyan-glow/80">{String(index + 1).padStart(2, "0")}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {report.debrief?.journalLinks?.worstTrade && onViewTrade && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/[0.08]"
                onClick={() => onViewTrade(report.debrief.journalLinks.worstTrade!.id)}
              >
                Review worst trade
              </Button>
              {report.debrief.journalLinks.bestTrade && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/[0.08]"
                  onClick={() => onViewTrade(report.debrief.journalLinks.bestTrade!.id)}
                >
                  Review best trade
                </Button>
              )}
            </div>
          )}
        </div>

        <footer className="relative shrink-0 border-t border-cyan-glow/10 bg-black/40 px-4 py-3 md:px-6">
          <p className="text-center font-mono text-[10px] text-muted-foreground/55">
            ESC to close · Data derived from your journal — no synthetic analytics
          </p>
        </footer>
      </div>
    </div>
  )
}
