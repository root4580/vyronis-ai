"use client"

import { useMemo, useState, type ReactNode } from "react"
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Plus,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardEmptyState,
} from "@/components/dashboard/dashboard-primitives"
import {
  RecentTradesTable,
  type DashboardTradeRow,
} from "@/components/dashboard/trading-components"
import { PlannedTradesSection } from "@/components/dashboard/planned-trades-section"
import { JournalAnalyticsStrip } from "@/components/journal/journal-analytics-strip"
import { journalDayCellClass, journalDayPnlClass } from "@/components/journal/journal-day-styles"
import { JournalSidebar } from "@/components/journal/journal-sidebar"
import { JournalTradeCards } from "@/components/journal/journal-trade-cards"
import {
  buildDrawdownStats,
  buildJournalMonthStats,
  buildSessionPerformance,
  buildWeekSummaries,
  buildWeekdayPerformance,
  filterTradesForDate,
  filterTradesForMonth,
  formatJournalDayPnl,
  formatMonthLabel,
  getJournalDayTone,
} from "@/lib/journal/calendar-analytics"
import type { JournalCalendarTrade } from "@/lib/journal/calendar-analytics"
import type { HeatmapDay } from "@/lib/performance-heatmap"
import { cn } from "@/lib/utils"

type PlannedSession = Parameters<typeof PlannedTradesSection>[0]["sessions"][0]

const WEEK_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

function JournalCalendarGrid({
  days,
  selectedDate,
  onSelectDate,
}: {
  days: HeatmapDay[]
  selectedDate: string | null
  onSelectDate: (date: string) => void
}) {
  return (
    <div className="hidden md:block">
      <div className="mb-2 grid grid-cols-7 gap-2">
        {WEEK_HEADERS.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          if (day.isPadding) {
            return <div key={`pad-${index}`} className="min-h-[4.5rem] sm:min-h-[5.5rem]" />
          }
          const tone = getJournalDayTone(day)
          const selected = selectedDate === day.date

          return (
            <button
              key={day.date || `day-${index}`}
              type="button"
              disabled={!day.inMonth}
              onClick={() => day.inMonth && day.tradeCount >= 0 && onSelectDate(day.date)}
              className={journalDayCellClass(day, { selected })}
            >
              <span className="text-[11px] font-medium text-muted-foreground/70">
                {day.dayNum}
              </span>
              {day.tradeCount > 0 ? (
                <>
                  <span
                    className={cn(
                      "mt-1 text-sm font-bold tabular-nums leading-none sm:text-base",
                      journalDayPnlClass(tone),
                    )}
                  >
                    {formatJournalDayPnl(day.pnl)}
                  </span>
                  <span className="mt-auto text-[9px] tabular-nums text-white/55 sm:text-[10px]">
                    {day.tradeCount} trade{day.tradeCount === 1 ? "" : "s"} · {day.winRate}%
                  </span>
                </>
              ) : (
                <span className="mt-auto text-[10px] text-muted-foreground/40">—</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function JournalMobileDayCards({
  days,
  selectedDate,
  onSelectDate,
}: {
  days: HeatmapDay[]
  selectedDate: string | null
  onSelectDate: (date: string) => void
}) {
  const traded = days.filter((d) => d.inMonth && !d.isPadding && d.tradeCount > 0)

  if (traded.length === 0) {
    return (
      <DashboardEmptyState
        icon={LayoutGrid}
        title="No trades this month"
        description="Log trades or change month to review your journal"
        className="min-h-[160px] md:hidden"
      />
    )
  }

  return (
    <div className="space-y-2 md:hidden">
      {traded.map((day) => {
        const tone = getJournalDayTone(day)
        const selected = selectedDate === day.date
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelectDate(day.date)}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all",
              tone === "win" &&
                "border-emerald-500/30 bg-emerald-950/60 hover:border-emerald-400/40",
              tone === "loss" && "border-rose-500/30 bg-rose-950/60 hover:border-rose-400/40",
              tone === "neutral" && "border-white/[0.08] bg-zinc-800/80",
              selected && "ring-2 ring-cyan-glow",
            )}
          >
            <div>
              <p className="text-[12px] font-medium text-foreground/90">
                {new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                {day.tradeCount} trades · {day.winRate}% win rate
              </p>
            </div>
            <p
              className={cn(
                "text-base font-bold tabular-nums",
                journalDayPnlClass(tone),
              )}
            >
              {formatJournalDayPnl(day.pnl)}
            </p>
          </button>
        )
      })}
    </div>
  )
}

export function JournalCommandCenter({
  trades,
  startingBalance = 10000,
  plannedSessions,
  isLoadingPlanned,
  deletingSessionId,
  onContinueCoach,
  onConvertToTrade,
  onDeletePlanned,
  onNewCoach,
  onEditTrade,
  onDeleteTrade,
  onViewTrade,
  onScreenshotClick,
  onClearJournalCsvDay,
  onLogTrade,
  headerActions,
}: {
  trades: DashboardTradeRow[]
  startingBalance?: number
  plannedSessions: PlannedSession[]
  isLoadingPlanned?: boolean
  deletingSessionId?: string | null
  onContinueCoach: (sessionId: string) => void
  onConvertToTrade: (sessionId: string) => void
  onDeletePlanned: (sessionId: string) => void
  onNewCoach: () => void
  onEditTrade?: (trade: DashboardTradeRow) => void
  onDeleteTrade?: (trade: DashboardTradeRow) => void
  onViewTrade?: (trade: DashboardTradeRow) => void
  onScreenshotClick?: (trade: DashboardTradeRow) => void
  onClearJournalCsvDay?: (dateKey: string) => void | Promise<void>
  /** Opens manual trade form; pass calendar day YYYY-MM-DD when drilling into a day */
  onLogTrade?: (tradeDate?: string) => void
  headerActions?: ReactNode
}) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const referenceDate = useMemo(
    () => new Date(viewYear, viewMonth, 1),
    [viewYear, viewMonth],
  )

  const monthStats = useMemo(
    () => buildJournalMonthStats(trades, referenceDate),
    [trades, referenceDate],
  )

  const weeks = useMemo(
    () => buildWeekSummaries(monthStats.days),
    [monthStats.days],
  )

  const monthTrades = useMemo(
    () => filterTradesForMonth(trades, viewYear, viewMonth),
    [trades, viewYear, viewMonth],
  )

  const drawdown = useMemo(
    () => buildDrawdownStats(trades, startingBalance),
    [trades, startingBalance],
  )

  const sessionPerf = useMemo(() => buildSessionPerformance(monthTrades), [monthTrades])
  const weekdayPerf = useMemo(() => buildWeekdayPerformance(monthTrades), [monthTrades])

  const dayTrades = useMemo(() => {
    if (!selectedDate) return []
    return filterTradesForDate(trades, selectedDate)
  }, [trades, selectedDate])

  const selectedDayMeta = useMemo(() => {
    if (!selectedDate) return null
    return monthStats.days.find((d) => d.date === selectedDate) ?? null
  }, [monthStats.days, selectedDate])

  const journalCsvOnSelectedDay = useMemo(
    () => dayTrades.filter((t) => t.import_source === "journal_csv"),
    [dayTrades],
  )

  const goPrevMonth = () => {
    const next = shiftMonth(viewYear, viewMonth, -1)
    setViewYear(next.year)
    setViewMonth(next.month)
    setSelectedDate(null)
  }

  const goNextMonth = () => {
    const next = shiftMonth(viewYear, viewMonth, 1)
    setViewYear(next.year)
    setViewMonth(next.month)
    setSelectedDate(null)
  }

  const hasTrades = trades.length > 0

  if (selectedDate) {
    const label = new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })

    return (
      <section className="dashboard-section space-y-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setSelectedDate(null)}
          className="h-9 gap-2 px-2 text-[13px] text-muted-foreground hover:text-cyan-glow"
        >
          <ArrowLeft className="size-4" />
          Back to calendar
        </Button>

        {selectedDayMeta && selectedDayMeta.tradeCount > 0 ? (
          <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "border-white/10",
                  selectedDayMeta.pnl >= 0
                    ? "bg-profit/10 text-profit"
                    : "bg-loss/10 text-loss",
                )}
              >
                {formatJournalDayPnl(selectedDayMeta.pnl)}
              </Badge>
              <span className="text-[12px] text-muted-foreground/80">
                {selectedDayMeta.tradeCount} trades · {selectedDayMeta.winRate}% win rate
              </span>
            </div>
            {onClearJournalCsvDay && journalCsvOnSelectedDay.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-fit border-loss/30 text-[11px] text-loss hover:bg-loss/[0.08]"
                onClick={() => void onClearJournalCsvDay(selectedDate!)}
              >
                Clear {journalCsvOnSelectedDay.length} CSV import
                {journalCsvOnSelectedDay.length === 1 ? "" : "s"} on this day
              </Button>
            ) : null}
          </div>
        ) : null}

        {onLogTrade ? (
          <Button
            type="button"
            onClick={() => onLogTrade(selectedDate)}
            className="h-9 w-full bg-cyan-glow/90 text-black hover:bg-cyan-glow sm:w-auto"
          >
            <Plus className="mr-2 size-4" />
            Log trade for this day
          </Button>
        ) : null}

        <JournalTradeCards
          trades={dayTrades as DashboardTradeRow[]}
          onEdit={onEditTrade}
          onDelete={onDeleteTrade}
          onViewTrade={onViewTrade}
          onScreenshotClick={onScreenshotClick}
        />

        <div className="hidden md:block">
          <RecentTradesTable
            trades={dayTrades as DashboardTradeRow[]}
            onEdit={onEditTrade}
            onDelete={onDeleteTrade}
            onViewTrade={onViewTrade}
            onScreenshotClick={onScreenshotClick}
            title={label}
            headerActions={headerActions}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="dashboard-section space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="dashboard-section-title">Trade Journal</p>
          <p className="mt-1 text-[12px] text-muted-foreground/70">
            Log trades manually — calendar, screenshots, emotions, and AI review
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
      </div>

      <PlannedTradesSection
        sessions={plannedSessions}
        isLoading={isLoadingPlanned}
        deletingSessionId={deletingSessionId}
        onContinueCoach={onContinueCoach}
        onConvertToTrade={onConvertToTrade}
        onDeletePlanned={onDeletePlanned}
        onNewCoach={onNewCoach}
      />

      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          <DashboardCard interactive glow className="glass-card col-span-2">
            <DashboardCardHeader
              title={formatMonthLabel(viewYear, viewMonth)}
              icon={BookOpen}
              badge={
                <Badge variant="outline" className="h-6 text-[10px] font-medium">
                  {monthStats.tradedDays} trading days
                </Badge>
              }
              action={
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={goPrevMonth}
                    className="size-8 border border-white/[0.06] bg-white/[0.03]"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={goNextMonth}
                    className="size-8 border border-white/[0.06] bg-white/[0.03]"
                    aria-label="Next month"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              }
            />
            <DashboardCardBody className="space-y-4 pt-1">
              {!hasTrades ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <DashboardEmptyState
                    icon={BookOpen}
                    title="Start your journal"
                    description="Tap New Trade to log a setup, screenshot, and how you felt — takes under a minute"
                    className="min-h-[160px]"
                  />
                  {onLogTrade ? (
                    <Button
                      type="button"
                      onClick={() => onLogTrade()}
                      className="bg-cyan-glow/90 text-black hover:bg-cyan-glow"
                    >
                      <Plus className="mr-2 size-4" />
                      Log first trade
                    </Button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:hidden">
                    <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                        Month P&L
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-base font-semibold tabular-nums",
                          monthStats.totalPnL >= 0 ? "text-profit" : "text-loss",
                        )}
                      >
                        {monthStats.totalPnL >= 0 ? "+" : "-"}$
                        {Math.abs(monthStats.totalPnL).toFixed(0)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                        Win days
                      </p>
                      <p className="mt-1 text-base font-semibold tabular-nums text-profit">
                        {monthStats.profitableDays}/{monthStats.tradedDays}
                      </p>
                    </div>
                  </div>

                  <JournalCalendarGrid
                    days={monthStats.days}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                  <JournalMobileDayCards
                    days={monthStats.days}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />

                  <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3 text-[10px] text-muted-foreground/70">
                    <span className="flex items-center gap-1.5">
                      <span className="size-3 rounded-md border border-emerald-500/35 bg-emerald-950/80" />
                      Winning day
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-3 rounded-md border border-rose-500/35 bg-rose-950/80" />
                      Losing day
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-3 rounded-md border border-white/[0.06] bg-zinc-900/80" />
                      No trades
                    </span>
                  </div>
                </>
              )}
            </DashboardCardBody>
          </DashboardCard>

          {hasTrades ? (
            <JournalAnalyticsStrip
              drawdown={drawdown}
              sessions={sessionPerf}
              weekdays={weekdayPerf}
            />
          ) : null}
        </div>

        <JournalSidebar
          monthStats={monthStats}
          weeks={weeks}
          className={hasTrades ? undefined : "xl:flex"}
        />
      </div>
    </section>
  )
}
