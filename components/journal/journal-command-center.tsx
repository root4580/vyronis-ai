"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ArrowLeft, BarChart3, Plus } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DashboardEmptyState } from "@/components/dashboard/dashboard-primitives"
import { type DashboardTradeRow } from "@/components/dashboard/trading-components"
import { PlannedTradesSection } from "@/components/dashboard/planned-trades-section"
import { JournalAnalyticsStrip } from "@/components/journal/journal-analytics-strip"
import { JournalCalendarView } from "@/components/journal/journal-calendar-view"
import { JournalIntelligenceMode } from "@/components/journal/journal-intelligence-mode"
import { JournalModeTabs } from "@/components/journal/journal-mode-tabs"
import { JournalTradeCards } from "@/components/journal/journal-trade-cards"
import { JournalWorkflowNav } from "@/components/journal/journal-workflow-nav"
import {
  buildDrawdownStats,
  buildJournalMonthStats,
  buildSessionPerformance,
  buildWeekdayPerformance,
  filterTradesForDate,
  formatJournalDayPnl,
} from "@/lib/journal/calendar-analytics"
import type { JournalViewMode } from "@/lib/journal/journal-workflow"
import { cn } from "@/lib/utils"

type PlannedSession = Parameters<typeof PlannedTradesSection>[0]["sessions"][0]

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
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
  onLogTrade?: (tradeDate?: string) => void
  headerActions?: ReactNode
}) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [journalMode, setJournalMode] = useState<JournalViewMode>("calendar")

  const referenceDate = useMemo(
    () => new Date(viewYear, viewMonth, 1),
    [viewYear, viewMonth],
  )

  const monthStats = useMemo(
    () => buildJournalMonthStats(trades, referenceDate),
    [trades, referenceDate],
  )

  const drawdown = useMemo(
    () => buildDrawdownStats(trades, startingBalance),
    [trades, startingBalance],
  )

  const monthTrades = useMemo(() => {
    return trades.filter((t) => {
      const key = t.trade_date?.split("T")[0] ?? t.created_at?.split("T")[0]
      if (!key) return false
      const [y, m] = key.split("-").map(Number)
      return y === viewYear && m - 1 === viewMonth
    })
  }, [trades, viewYear, viewMonth])

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
    return (
      <section className="dashboard-section space-y-4">
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
                onClick={() => void onClearJournalCsvDay(selectedDate)}
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
      </section>
    )
  }

  return (
    <section className="dashboard-section space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="dashboard-section-title">Decision journal</p>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted-foreground/70">
            Plan before you trade — calendar intelligence, analytics, and pattern memory
            (not just a trade log).
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto">{headerActions}</div>
      </div>

      <JournalWorkflowNav />
      <JournalModeTabs mode={journalMode} onChange={setJournalMode} />

      <PlannedTradesSection
        sessions={plannedSessions}
        isLoading={isLoadingPlanned}
        deletingSessionId={deletingSessionId}
        onContinueCoach={onContinueCoach}
        onConvertToTrade={onConvertToTrade}
        onDeletePlanned={onDeletePlanned}
        onNewCoach={onNewCoach}
      />

      {journalMode === "calendar" ? (
        <JournalCalendarView
          trades={trades}
          viewYear={viewYear}
          viewMonth={viewMonth}
          onPrevMonth={goPrevMonth}
          onNextMonth={goNextMonth}
          onSelectDate={setSelectedDate}
          onLogTrade={onLogTrade ? () => onLogTrade() : undefined}
        />
      ) : null}

      {journalMode === "analytics" && hasTrades ? (
        <JournalAnalyticsStrip drawdown={drawdown} sessions={sessionPerf} weekdays={weekdayPerf} />
      ) : null}

      {journalMode === "analytics" && !hasTrades ? (
        <DashboardEmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Log trades to unlock drawdown, session, and weekday intelligence"
          className="min-h-[200px]"
        />
      ) : null}

      {journalMode === "intelligence" ? (
        <JournalIntelligenceMode trades={trades} maxRiskPerTrade={1} />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
        <Link href="/war-room" className="text-[11px] font-medium text-cyan-glow hover:underline">
          Weekly War Room →
        </Link>
        {journalMode !== "calendar" && hasTrades ? (
          <button
            type="button"
            onClick={() => setJournalMode("calendar")}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            View calendar
          </button>
        ) : null}
      </div>
    </section>
  )
}
