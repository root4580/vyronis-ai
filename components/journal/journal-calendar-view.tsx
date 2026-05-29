"use client"

import { useMemo } from "react"
import { BookOpen, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardEmptyState,
} from "@/components/dashboard/dashboard-primitives"
import { journalDayCellClass, journalDayPnlClass } from "@/components/journal/journal-day-styles"
import { JournalSidebar } from "@/components/journal/journal-sidebar"
import {
  buildDailyIntelligenceMap,
  getDailyScores,
  scoreLabel,
} from "@/lib/journal/daily-intelligence-scores"
import {
  buildJournalMonthStats,
  buildWeekSummaries,
  formatJournalDayPnl,
  formatMonthLabel,
  getJournalDayTone,
} from "@/lib/journal/calendar-analytics"
import type { JournalCalendarTrade } from "@/lib/journal/calendar-analytics"
import type { HeatmapDay } from "@/lib/performance-heatmap"
import { cn } from "@/lib/utils"

const WEEK_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

function CalendarGrid({
  days,
  dailyScores,
  onSelectDate,
}: {
  days: HeatmapDay[]
  dailyScores: ReturnType<typeof buildDailyIntelligenceMap>
  onSelectDate: (date: string) => void
}) {
  return (
    <div className="hidden sm:block">
      <div className="mb-2 grid grid-cols-7 gap-1 sm:gap-2">
        {WEEK_HEADERS.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((day, index) => {
          if (day.isPadding) {
            return <div key={`pad-${index}`} className="min-h-[4.5rem] sm:min-h-[5.5rem]" />
          }
          const tone = getJournalDayTone(day)
          const scores = getDailyScores(dailyScores, day.date, day.tradeCount)
          const isDiscipline = scores.disciplineDay && day.inMonth

          return (
            <button
              key={day.date || `day-${index}`}
              type="button"
              disabled={!day.inMonth}
              onClick={() => day.inMonth && onSelectDate(day.date)}
              className={cn(
                journalDayCellClass(day, {}),
                isDiscipline && "border-zinc-600/40 bg-zinc-800/50",
              )}
            >
              <span className="text-[11px] font-medium text-muted-foreground/70">
                {day.dayNum}
              </span>
              {day.tradeCount > 0 ? (
                <>
                  <span
                    className={cn(
                      "mt-0.5 text-sm font-bold tabular-nums leading-none sm:text-base",
                      journalDayPnlClass(tone),
                    )}
                  >
                    {formatJournalDayPnl(day.pnl)}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1 text-[8px] tabular-nums sm:text-[9px]">
                    {scores.emotionalScore != null ? (
                      <span className="rounded bg-black/30 px-1 text-violet-200/90">
                        E {scores.emotionalScore}
                      </span>
                    ) : null}
                    {scores.executionScore != null ? (
                      <span className="rounded bg-black/30 px-1 text-cyan-glow/90">
                        X {scores.executionScore}
                      </span>
                    ) : null}
                  </div>
                  <span className="mt-auto text-[9px] text-white/50">
                    {day.tradeCount} trade{day.tradeCount === 1 ? "" : "s"}
                  </span>
                </>
              ) : day.inMonth ? (
                <span className="mt-auto text-[9px] text-muted-foreground/45">No trades</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MobileDayList({
  days,
  dailyScores,
  onSelectDate,
}: {
  days: HeatmapDay[]
  dailyScores: ReturnType<typeof buildDailyIntelligenceMap>
  onSelectDate: (date: string) => void
}) {
  const traded = days.filter((d) => d.inMonth && !d.isPadding && d.tradeCount > 0)
  const discipline = days.filter(
    (d) => d.inMonth && !d.isPadding && d.tradeCount === 0 && d.date,
  )

  return (
    <div className="space-y-3 sm:hidden">
      {traded.map((day) => {
        const tone = getJournalDayTone(day)
        const scores = getDailyScores(dailyScores, day.date, day.tradeCount)
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelectDate(day.date)}
            className={cn(
              "flex w-full flex-col gap-2 rounded-xl border px-4 py-3 text-left",
              tone === "win" && "border-emerald-500/30 bg-emerald-950/50",
              tone === "loss" && "border-rose-500/30 bg-rose-950/50",
              tone === "neutral" && "border-white/[0.08] bg-zinc-800/80",
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium">
                {new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className={cn("text-base font-bold tabular-nums", journalDayPnlClass(tone))}>
                {formatJournalDayPnl(day.pnl)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px]">
              {scores.emotionalScore != null ? (
                <span className="text-violet-200/90">
                  Emotion {scores.emotionalScore} · {scoreLabel(scores.emotionalScore)}
                </span>
              ) : null}
              {scores.executionScore != null ? (
                <span className="text-cyan-glow/90">
                  Execution {scores.executionScore} · {scoreLabel(scores.executionScore)}
                </span>
              ) : null}
            </div>
          </button>
        )
      })}
      {discipline.length > 0 ? (
        <p className="text-[10px] text-muted-foreground/60">
          {discipline.length} no-trade day{discipline.length === 1 ? "" : "s"} this month (discipline)
        </p>
      ) : null}
    </div>
  )
}

export function JournalCalendarView({
  trades,
  viewYear,
  viewMonth,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  onLogTrade,
}: {
  trades: JournalCalendarTrade[]
  viewYear: number
  viewMonth: number
  onPrevMonth: () => void
  onNextMonth: () => void
  onSelectDate: (date: string) => void
  onLogTrade?: () => void
}) {
  const referenceDate = useMemo(
    () => new Date(viewYear, viewMonth, 1),
    [viewYear, viewMonth],
  )
  const monthStats = useMemo(
    () => buildJournalMonthStats(trades, referenceDate),
    [trades, referenceDate],
  )
  const weeks = useMemo(() => buildWeekSummaries(monthStats.days), [monthStats.days])
  const dailyScores = useMemo(() => buildDailyIntelligenceMap(trades), [trades])
  const hasTrades = trades.length > 0

  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      <div className="min-w-0 flex-1">
        <DashboardCard interactive glow className="glass-card">
          <DashboardCardHeader
            title={formatMonthLabel(viewYear, viewMonth)}
            icon={BookOpen}
            badge={
              <Badge variant="outline" className="h-6 text-[10px]">
                {monthStats.tradedDays} active · {monthStats.days.filter((d) => d.inMonth && !d.isPadding && d.tradeCount === 0).length} discipline
              </Badge>
            }
            action={
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onPrevMonth}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onNextMonth}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            }
          />
          <DashboardCardBody className="space-y-4 pt-1">
            {!hasTrades ? (
              <DashboardEmptyState
                icon={BookOpen}
                title="Start your learning journal"
                description="Log trades to build calendar intelligence — not just a history table"
                className="min-h-[160px]"
              />
            ) : (
              <>
                <CalendarGrid
                  days={monthStats.days}
                  dailyScores={dailyScores}
                  onSelectDate={onSelectDate}
                />
                <MobileDayList
                  days={monthStats.days}
                  dailyScores={dailyScores}
                  onSelectDate={onSelectDate}
                />
                <div className="flex flex-wrap gap-3 border-t border-white/[0.06] pt-3 text-[10px] text-muted-foreground/70">
                  <span className="flex items-center gap-1.5">
                    <span className="size-3 rounded-md border border-emerald-500/35 bg-emerald-950/80" />
                    Win day
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-3 rounded-md border border-rose-500/35 bg-rose-950/80" />
                    Loss day
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-3 rounded-md border border-zinc-500/35 bg-zinc-800/80" />
                    No-trade discipline
                  </span>
                </div>
              </>
            )}
            {onLogTrade ? (
              <Button
                type="button"
                onClick={onLogTrade}
                className="w-full bg-cyan-glow/90 text-black hover:bg-cyan-glow sm:w-auto"
              >
                <Plus className="mr-2 size-4" />
                Log trade
              </Button>
            ) : null}
          </DashboardCardBody>
        </DashboardCard>
      </div>
      {hasTrades ? <JournalSidebar monthStats={monthStats} weeks={weeks} className="xl:w-72" /> : null}
    </div>
  )
}
