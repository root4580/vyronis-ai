"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ImageIcon,
  Loader2,
} from "lucide-react"
import { SetupGradeBadge } from "@/components/command-center/setup-grade-badge"
import { Button } from "@/components/ui/button"
import { fetchChapterReview } from "@/lib/weekly-chapters/api-client"
import type { ChapterReviewPayload, ChapterReviewTrade } from "@/lib/weekly-chapters/types"
import { formatChapterTitle } from "@/lib/weekly-chapters/week-utils"
import {
  getChapterReviewHref,
  getDashboardHomeHref,
  getTradeReplayHref,
} from "@/lib/dashboard-nav"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import type { SetupGrade } from "@/lib/strategy-brain/types"
import { cn } from "@/lib/utils"

type ChapterReviewViewProps = {
  weekStart: string
  accountId: string | null
}

function isSetupGrade(value: string | null | undefined): value is SetupGrade {
  if (!value?.trim()) return false
  const normalized = value.replace(/\s+/g, "").toUpperCase()
  return normalized === "A+" || ["A", "B", "C", "D"].includes(normalized)
}

export function ChapterReviewView({ weekStart, accountId }: ChapterReviewViewProps) {
  const router = useRouter()
  const [review, setReview] = useState<ChapterReviewPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!accountId) {
      setReview(null)
      setError("Select an account to view chapter history.")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const payload = await fetchChapterReview(weekStart, accountId)
      setReview(payload)
    } catch (e) {
      setReview(null)
      setError(e instanceof Error ? e.message : "Could not load chapter review")
    } finally {
      setIsLoading(false)
    }
  }, [accountId, weekStart])

  useEffect(() => {
    void load()
  }, [load])

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-cyan-glow/80" />
      </div>
    )
  }

  if (error || !review) {
    return (
      <div className="hq-surface-card px-4 py-8 text-center">
        <p className="text-[13px] text-text-secondary">{error ?? "Chapter not found"}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => router.push(getDashboardHomeHref())}
        >
          Back to HQ
        </Button>
      </div>
    )
  }

  const { summary } = review
  const statusLabel = review.isClosed ? "Closed" : "In progress"
  const nextChapterNumber = summary.chapter_number + 1

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-text-muted hover:text-text-primary"
          onClick={() => router.push(getDashboardHomeHref())}
        >
          <ChevronLeft className="mr-1 size-4" />
          HQ
        </Button>
      </div>

      <header className="hq-surface-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] bg-cyan-glow/[0.05] px-4 py-4">
          <div className="flex flex-wrap items-start gap-2">
            <BookOpen className="mt-0.5 size-4 text-cyan-glow/90" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/75">
                Chapter review
              </p>
              <h1 className="text-[18px] font-medium text-text-primary">
                {formatChapterTitle(summary.chapter_number, summary.week_start)}
              </h1>
              <p className="mt-1 text-[12px] text-text-muted">
                {statusLabel} · {summary.trades_taken} live trade
                {summary.trades_taken === 1 ? "" : "s"} · {summary.win_rate}% win ·{" "}
                <span
                  className={getPnLTextClass(summary.pnl, summary.pnl >= 0 ? "WIN" : "LOSS")}
                >
                  {formatPnL(summary.pnl, summary.pnl >= 0 ? "WIN" : "LOSS")}
                </span>
              </p>
              {review.paperLine ? (
                <p className="mt-1 text-[11px] text-violet-200/80">📝 Practice: {review.paperLine}</p>
              ) : null}
            </div>
          </div>
        </div>

        {summary.discipline_grade && summary.discipline_score != null ? (
          <div className="border-b border-[var(--border-subtle)] px-4 py-2.5 text-[11px] text-text-secondary">
            Discipline this chapter: {summary.discipline_grade} (
            {Math.round(summary.discipline_score)})
          </div>
        ) : null}
      </header>

      {review.patterns.length > 0 ? (
        <section className="hq-surface-card px-4 py-4">
          <h2 className="text-[13px] font-medium text-text-primary">🔍 Patterns noticed</h2>
          <ul className="mt-3 space-y-2">
            {review.patterns.map((pattern) => (
              <li
                key={pattern.id}
                className="rounded-[var(--radius-md)] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[12px] leading-relaxed text-text-secondary"
              >
                {pattern.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="hq-surface-card px-4 py-4">
        <h2 className="text-[13px] font-medium text-text-primary">
          📚 What Chapter {summary.chapter_number} taught you
        </h2>
        <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-text-secondary">
          {summary.key_lesson ? (
            <li className="flex gap-2">
              <span className="text-profit">✅</span>
              <span>{summary.key_lesson}</span>
            </li>
          ) : null}
          {review.coachInsights.map((insight) => (
            <li key={insight} className="flex gap-2">
              <span className="text-cyan-glow">💬</span>
              <span>{insight}</span>
            </li>
          ))}
        </ul>

        {review.emotionTimeline.length > 0 ? (
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Emotions this chapter
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {review.emotionTimeline.map((entry, index) => (
                <span
                  key={`${entry.pair}-${entry.emotion}-${index}`}
                  className={cn(
                    "rounded-[var(--radius-sm)] border px-2 py-1 text-[10px]",
                    entry.result.toUpperCase() === "WIN"
                      ? "border-profit/25 bg-profit/[0.08] text-profit"
                      : entry.result.toUpperCase() === "LOSS"
                        ? "border-loss/25 bg-loss/[0.08] text-loss"
                        : "border-white/[0.08] bg-white/[0.03] text-text-muted",
                  )}
                >
                  {entry.pair} · {entry.emotion}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="hq-surface-card px-4 py-4">
        <h2 className="text-[13px] font-medium text-text-primary">
          💡 One thing to apply in Chapter {nextChapterNumber}
        </h2>
        <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">
          {review.carryForwardLesson}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-[13px] font-medium text-text-primary">Live trades this chapter</h2>
        {review.trades.length === 0 ? (
          <div className="hq-surface-card px-4 py-6 text-center text-[12px] text-text-muted">
            No live trades logged this week
            {review.paperLine ? " — see Practice stats above." : "."}
          </div>
        ) : (
          review.trades.map((trade) => (
            <ChapterReviewTradeCard key={trade.id} trade={trade} />
          ))
        )}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/[0.06] bg-[var(--surface-page)]/95 px-4 py-3 backdrop-blur-md md:static md:rounded-[var(--radius-md)] md:border md:bg-[var(--surface-card)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!review.navigation.previousWeekStart}
            className="min-h-10 flex-1 text-[11px]"
            onClick={() => {
              if (review.navigation.previousWeekStart) {
                router.push(getChapterReviewHref(review.navigation.previousWeekStart))
              }
            }}
          >
            <ArrowLeft className="mr-1 size-3.5" />
            Previous
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="hidden min-h-10 shrink-0 text-[11px] sm:inline-flex"
            onClick={() => router.push(getDashboardHomeHref())}
          >
            Back to HQ
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!review.navigation.nextWeekStart}
            className="min-h-10 flex-1 text-[11px]"
            onClick={() => {
              if (review.navigation.nextWeekStart) {
                router.push(getChapterReviewHref(review.navigation.nextWeekStart))
              }
            }}
          >
            Next
            <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </div>
      </nav>
    </div>
  )
}

function ChapterReviewTradeCard({ trade }: { trade: ChapterReviewTrade }) {
  const resultUpper = trade.result.toUpperCase()
  const isWin = resultUpper === "WIN"
  const isLoss = resultUpper === "LOSS"
  const chartUrl = trade.chart_url

  return (
    <article className="hq-surface-card overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:flex-row">
        <div className="shrink-0">
          {chartUrl ? (
            <a
              href={chartUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-[var(--radius-md)] border border-white/[0.08] bg-black/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={chartUrl}
                alt={`${trade.pair} chart`}
                className="size-[88px] object-cover sm:size-[104px]"
              />
            </a>
          ) : (
            <div className="flex size-[88px] items-center justify-center rounded-[var(--radius-md)] border border-dashed border-white/[0.1] bg-white/[0.02] sm:size-[104px]">
              <ImageIcon className="size-5 text-text-muted/50" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[14px] font-medium text-text-primary">
                  {trade.pair}{" "}
                  <span className="text-[12px] font-normal text-text-muted">{trade.direction}</span>
                </p>
                {isSetupGrade(trade.coach_grade) ? (
                  <SetupGradeBadge grade={trade.coach_grade} label="Coach" size="sm" />
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {[trade.session, trade.emotion].filter(Boolean).join(" · ") || "No session tagged"}
              </p>
            </div>
            <div className="text-right">
              <span
                className={cn(
                  "rounded-[var(--radius-sm)] px-2 py-0.5 text-[10px] font-semibold uppercase",
                  isWin && "bg-profit/15 text-profit",
                  isLoss && "bg-loss/15 text-loss",
                  !isWin && !isLoss && "bg-white/[0.06] text-text-muted",
                )}
              >
                {trade.result}
              </span>
              <p
                className={cn(
                  "mt-1 text-[13px] font-semibold tabular-nums",
                  getPnLTextClass(trade.pnl, isWin ? "WIN" : isLoss ? "LOSS" : "BREAKEVEN"),
                )}
              >
                {formatPnL(trade.pnl, isWin ? "WIN" : isLoss ? "LOSS" : "BREAKEVEN")}
              </p>
            </div>
          </div>

          {(trade.entry_price != null || trade.stop_loss != null || trade.take_profit != null) && (
            <p className="mt-2 font-mono text-[10px] text-text-muted">
              {trade.entry_price != null ? `Entry ${trade.entry_price}` : null}
              {trade.stop_loss != null ? ` · SL ${trade.stop_loss}` : null}
              {trade.take_profit != null ? ` · TP ${trade.take_profit}` : null}
            </p>
          )}

          {trade.what_went_right ? (
            <p className="mt-2 text-[11px] leading-relaxed text-profit/90">
              ✓ {trade.what_went_right}
            </p>
          ) : null}
          {trade.what_went_wrong ? (
            <p className="mt-1 text-[11px] leading-relaxed text-loss/90">✗ {trade.what_went_wrong}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href={getTradeReplayHref(trade.id)}
              className="inline-flex text-[11px] font-medium text-cyan-glow hover:underline"
            >
              View trade replay →
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
