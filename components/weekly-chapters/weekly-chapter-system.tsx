"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileEdit,
  Flame,
  Loader2,
  Sparkles,
  Sun,
} from "lucide-react"
import { PaperGraduationBanner } from "@/components/paper-trades/paper-graduation-banner"
import { fetchWeeklyChapterDashboard } from "@/lib/weekly-chapters/api-client"
import type { WeeklyChapterDashboard, WeeklySummaryRecord } from "@/lib/weekly-chapters/types"
import type { TradingRulesSnapshot } from "@/lib/trading-rules/types"
import { formatWeekOfLabel } from "@/lib/weekly-chapters/week-utils"
import {
  formatWeeklyPaperSummaryLine,
  readWeeklySummaryPaperStats,
} from "@/lib/weekly-chapters/paper-stats"
import { getChapterReviewHref, getCouncilHref } from "@/lib/dashboard-nav"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import { disciplineGradeBoxClass } from "@/lib/trade-planner/plan-streak"
import type { PlanDisciplineGrade } from "@/lib/trade-planner/deviation-engine"
import { cn } from "@/lib/utils"

type WeeklyChapterSystemProps = {
  accountId: string | null
  traderFirstName?: string | null
  disciplineScore?: number | null
  disciplineGrade?: string | null
  tradingRulesSnapshot?: TradingRulesSnapshot | null
  className?: string
}

export function WeeklyChapterSystem({
  accountId,
  traderFirstName,
  disciplineScore,
  disciplineGrade,
  tradingRulesSnapshot,
  className,
}: WeeklyChapterSystemProps) {
  const [dashboard, setDashboard] = useState<WeeklyChapterDashboard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [carryOpen, setCarryOpen] = useState(false)
  const [dismissedSunday, setDismissedSunday] = useState(false)

  const load = useCallback(async () => {
    if (!accountId) {
      setDashboard(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const payload = await fetchWeeklyChapterDashboard({
        accountId,
        traderFirstName,
        disciplineScore,
        disciplineGrade,
      })
      setDashboard(payload)
    } catch {
      setDashboard(null)
    } finally {
      setIsLoading(false)
    }
  }, [accountId, traderFirstName, disciplineScore, disciplineGrade])

  useEffect(() => {
    void load()
  }, [load])

  if (isLoading) {
    return (
      <div className={cn("hq-surface-card flex min-h-[160px] items-center justify-center", className)}>
        <Loader2 className="size-5 animate-spin text-cyan-glow/80" />
      </div>
    )
  }

  if (!dashboard || dashboard.migrationPending) {
    return (
      <div className={cn("hq-surface-card px-4 py-4 text-[12px] text-text-muted", className)}>
        Weekly Chapter System needs migration. Run{" "}
        <code className="text-text-secondary">supabase/038-weekly-chapters.sql</code> in Supabase.
      </div>
    )
  }

  const tradesUsed =
    tradingRulesSnapshot?.tradesThisWeek ?? dashboard.thisWeek.tradesTaken
  const maxTrades =
    tradingRulesSnapshot?.rules.max_trades_per_week ?? dashboard.thisWeek.maxTrades

  return (
    <div className={cn("space-y-3", className)}>
      {dashboard.mondayMessage ? (
        <MondayBanner message={dashboard.mondayMessage} />
      ) : null}

      {dashboard.toughWeekReminder ? (
        <ToughWeekBanner message={dashboard.toughWeekReminder} />
      ) : null}

      {dashboard.showSundayComplete &&
      dashboard.sundayCompletePreview &&
      !dismissedSunday ? (
        <SundayCompleteCard
          summary={dashboard.sundayCompletePreview}
          onDismiss={() => setDismissedSunday(true)}
        />
      ) : null}

      {dashboard.thisWeekPaper?.readyForLive ? (
        <PaperGraduationBanner
          winStreak={dashboard.thisWeekPaper.winStreak}
          variant="hq"
        />
      ) : null}

      <div className="hq-surface-card overflow-hidden">
        <div
          className="border-b border-[var(--border-subtle)] px-4 py-4"
          style={{
            background:
              "linear-gradient(135deg, rgb(from var(--color-accent) r g b / 0.08) 0%, transparent 55%)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <BookOpen className="size-4 text-cyan-glow/90" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-glow/75">
                  Weekly chapter
                </p>
                {dashboard.chapterStreak >= 2 ? (
                  <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-profit/30 bg-profit/[0.1] px-2 py-0.5 text-[10px] font-medium text-profit">
                    <Flame className="size-3" />
                    {dashboard.chapterStreak} winning chapters
                  </span>
                ) : null}
              </div>
              <h2 className="text-[18px] font-medium text-text-primary">{dashboard.title}</h2>
              <p className="mt-1 text-[12px] text-text-secondary">{dashboard.subtitle}</p>
            </div>
            {dashboard.chapterStreak >= 3 ? (
              <div className="rounded-[var(--radius-md)] border border-profit/25 bg-profit/[0.08] px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.1em] text-profit/80">Momentum</p>
                <p className="text-[13px] font-semibold text-profit">
                  🔥 {dashboard.chapterStreak} chapters
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)] md:grid-cols-4">
          <ChapterStat
            label="Trades"
            value={`${tradesUsed}/${maxTrades}`}
            sub="used this week"
          />
          <ChapterStat label="Win rate" value={`${dashboard.thisWeek.winRate}%`} sub="this week" />
          <ChapterStat
            label="P&L"
            value={formatPnL(dashboard.thisWeek.pnl, dashboard.thisWeek.pnl >= 0 ? "WIN" : "LOSS")}
            sub="this week"
            valueClassName={getPnLTextClass(
              dashboard.thisWeek.pnl,
              dashboard.thisWeek.pnl >= 0 ? "WIN" : "LOSS",
            )}
          />
          <ChapterStat
            label="Discipline"
            value={
              dashboard.thisWeek.disciplineGrade && dashboard.thisWeek.disciplineScore != null
                ? `${dashboard.thisWeek.disciplineGrade} (${Math.round(dashboard.thisWeek.disciplineScore)})`
                : disciplineGrade && disciplineScore != null
                  ? `${disciplineGrade} (${Math.round(disciplineScore)})`
                  : "—"
            }
            sub="this week"
            badgeClass={disciplineGradeBoxClass(
              (dashboard.thisWeek.disciplineGrade ??
                disciplineGrade ??
                null) as PlanDisciplineGrade | null,
            )}
          />
        </div>

        {dashboard.thisWeekPaper ? (
          <PaperPracticeRow stats={dashboard.thisWeekPaper} />
        ) : null}
      </div>

      {dashboard.previousChapter && !dashboard.carryForwardMessage ? (
        <div className="rounded-[var(--radius-md)] border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
          <PreviousChapterLine summary={dashboard.previousChapter} compact />
          <Link
            href={getChapterReviewHref(dashboard.previousChapter.week_start)}
            className="mt-2.5 inline-flex min-h-10 w-full items-center justify-center rounded-[var(--radius-md)] border border-white/[0.1] bg-white/[0.03] px-3 text-[12px] font-medium text-text-secondary transition-colors hover:bg-white/[0.05] hover:text-text-primary"
          >
            📖 Review Chapter {dashboard.previousChapter.chapter_number}
          </Link>
        </div>
      ) : null}

      {dashboard.carryForwardMessage && dashboard.previousChapter ? (
        <div className="rounded-[var(--radius-md)] border border-warning/25 bg-warning/[0.06]">
          <button
            type="button"
            onClick={() => setCarryOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
          >
            <p className="text-[11px] leading-relaxed text-warning-muted">
              📖 {dashboard.carryForwardMessage}
            </p>
            {carryOpen ? (
              <ChevronUp className="size-4 shrink-0 text-warning-muted" />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-warning-muted" />
            )}
          </button>
          {carryOpen ? (
            <div className="border-t border-warning/20 px-3 py-2.5">
              <PreviousChapterLine summary={dashboard.previousChapter} />
            </div>
          ) : (
            <div className="space-y-2.5 px-3 pb-2.5">
              <PreviousChapterLine summary={dashboard.previousChapter} compact />
              <Link
                href={getChapterReviewHref(dashboard.previousChapter.week_start)}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-[var(--radius-md)] border border-warning/35 bg-warning/[0.08] px-3 text-[12px] font-medium text-warning-muted transition-colors hover:bg-warning/[0.12]"
              >
                📖 Review Chapter {dashboard.previousChapter.chapter_number}
              </Link>
            </div>
          )}
          {carryOpen ? (
            <div className="border-t border-warning/20 px-3 pb-3 pt-2">
              <Link
                href={getChapterReviewHref(dashboard.previousChapter.week_start)}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-[var(--radius-md)] border border-warning/35 bg-warning/[0.08] px-3 text-[12px] font-medium text-warning-muted transition-colors hover:bg-warning/[0.12]"
              >
                📖 Review Chapter {dashboard.previousChapter.chapter_number}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ChapterStat({
  label,
  value,
  sub,
  valueClassName,
  badgeClass,
}: {
  label: string
  value: string
  sub?: string
  valueClassName?: string
  badgeClass?: string
}) {
  return (
    <div className="bg-[var(--surface-card)] px-3 py-3.5">
      <p className="section-label mb-1">{label}</p>
      {badgeClass ? (
        <span
          className={cn(
            "inline-flex rounded-[var(--radius-sm)] border px-2 py-0.5 text-[15px] font-semibold tabular-nums",
            badgeClass,
          )}
        >
          {value}
        </span>
      ) : (
        <p className={cn("text-[22px] font-medium tabular-nums text-text-primary", valueClassName)}>
          {value}
        </p>
      )}
      {sub ? <p className="mt-1 text-[10px] text-text-muted">{sub}</p> : null}
    </div>
  )
}

function PreviousChapterLine({
  summary,
  compact,
}: {
  summary: WeeklySummaryRecord
  compact?: boolean
}) {
  const paperLine = formatWeeklyPaperSummaryLine(readWeeklySummaryPaperStats(summary))
  const line = `${formatWeekOfLabel(summary.week_start)}: ${summary.trades_taken} live · ${summary.win_rate}% win · ${formatPnL(summary.pnl, summary.pnl >= 0 ? "WIN" : "LOSS")}`
  if (compact) {
    return (
      <div className="space-y-0.5">
        <p className="text-[10px] tabular-nums text-text-muted">{line}</p>
        {paperLine ? <p className="text-[10px] text-text-muted">📝 {paperLine}</p> : null}
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-text-secondary">Last chapter recap</p>
      <p className="text-[11px] tabular-nums text-text-muted">{line}</p>
      {paperLine ? <p className="text-[11px] text-text-muted">📝 {paperLine}</p> : null}
      {summary.key_lesson ? (
        <p className="text-[11px] italic text-text-secondary">“{summary.key_lesson}”</p>
      ) : null}
    </div>
  )
}

function PaperPracticeRow({
  stats,
}: {
  stats: NonNullable<WeeklyChapterDashboard["thisWeekPaper"]>
}) {
  const line = formatWeeklyPaperSummaryLine(stats)
  if (!line) return null

  return (
    <div className="border-t border-[var(--border-subtle)] bg-violet-500/[0.04] px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-start gap-2">
        <FileEdit className="mt-0.5 size-4 shrink-0 text-violet-300/90" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-300/80">
            Practice Room · this week
          </p>
          <p className="mt-0.5 text-[12px] text-text-secondary">{line}</p>
          {stats.readyForLive ? (
            <p className="mt-1 text-[11px] font-medium text-profit">
              🎓 Setup proven — ready to go live when your rules allow.
            </p>
          ) : stats.winStreak > 0 ? (
            <p className="mt-1 text-[10px] text-text-muted">
              {stats.winStreak}/3 winning paper trades toward graduation.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function MondayBanner({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-cyan-glow/25 bg-cyan-glow/[0.06] px-4 py-3">
      <div className="flex gap-2">
        <Sun className="mt-0.5 size-4 shrink-0 text-cyan-glow" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-relaxed text-text-primary">{message}</p>
          <Link
            href={getCouncilHref()}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-glow hover:underline"
          >
            Open morning briefing
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function ToughWeekBanner({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
      <div className="flex gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-text-accent" />
        <p className="text-[11px] leading-relaxed text-text-secondary">{message}</p>
      </div>
    </div>
  )
}

function SundayCompleteCard({
  summary,
  onDismiss,
}: {
  summary: WeeklySummaryRecord
  onDismiss: () => void
}) {
  const paperLine = formatWeeklyPaperSummaryLine(readWeeklySummaryPaperStats(summary))

  return (
    <div className="hq-surface-card overflow-hidden border border-cyan-glow/20">
      <div className="border-b border-[var(--border-subtle)] bg-cyan-glow/[0.05] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">
          Chapter closing tonight
        </p>
        <h3 className="mt-0.5 text-[15px] font-medium text-text-primary">
          Chapter {summary.chapter_number} Complete
        </h3>
      </div>
      <div className="space-y-2 px-4 py-3 text-[12px] text-text-secondary">
        <p>✅ Live trades: {summary.trades_taken}/{summary.max_trades_allowed}</p>
        <p>📊 Win rate: {summary.win_rate}%</p>
        {paperLine ? <p>📝 Practice: {paperLine}</p> : null}
        <p>
          💰 P&L:{" "}
          <span className={getPnLTextClass(summary.pnl, summary.pnl >= 0 ? "WIN" : "LOSS")}>
            {formatPnL(summary.pnl, summary.pnl >= 0 ? "WIN" : "LOSS")}
          </span>
        </p>
        <p>
          🎯 Discipline:{" "}
          {summary.discipline_grade && summary.discipline_score != null
            ? `${summary.discipline_grade} (${Math.round(summary.discipline_score)})`
            : "—"}
        </p>
        {summary.key_lesson ? (
          <p className="border-t border-[var(--border-subtle)] pt-2 text-[11px] italic text-text-primary">
            💡 Key lesson: “{summary.key_lesson}”
          </p>
        ) : null}
        <p className="text-[10px] text-text-muted">
          Saved to your chapter history — past chapters are remembered, not erased.
        </p>
        <Link
          href={getChapterReviewHref(summary.week_start)}
          className="inline-flex min-h-10 w-full items-center justify-center rounded-[var(--radius-md)] border border-cyan-glow/35 bg-cyan-glow/[0.1] px-3 text-[12px] font-medium text-cyan-glow transition-colors hover:bg-cyan-glow/[0.14]"
        >
          📖 Review Chapter {summary.chapter_number}
        </Link>
        <Link
          href={`${getChapterReviewHref(summary.week_start)}#war-room-recap`}
          className="inline-flex min-h-10 w-full items-center justify-center rounded-[var(--radius-md)] border border-white/[0.1] bg-white/[0.03] px-3 text-[12px] font-medium text-text-secondary transition-colors hover:bg-white/[0.05] hover:text-text-primary"
        >
          War Room vs reality →
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="w-full text-center text-[11px] text-text-muted hover:text-cyan-glow"
        >
          Dismiss for tonight
        </button>
      </div>
    </div>
  )
}
