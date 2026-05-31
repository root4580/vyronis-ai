"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ArrowLeft, BarChart3, Plus } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CollapsibleDashboardSection } from "@/components/dashboard/collapsible-dashboard-section"
import { DashboardEmptyState } from "@/components/dashboard/dashboard-primitives"
import { DashboardRecentTradesSection } from "@/components/dashboard/dashboard-recent-trades-section"
import { type DashboardTradeRow } from "@/components/dashboard/trading-components"
import { PlannedTradesSection } from "@/components/dashboard/planned-trades-section"
import { JournalAnalyticsStrip } from "@/components/journal/journal-analytics-strip"
import { JournalCalendarView } from "@/components/journal/journal-calendar-view"
import { JournalIntelligenceMode } from "@/components/journal/journal-intelligence-mode"
import { JournalModeTabs } from "@/components/journal/journal-mode-tabs"
import { JournalMonthStrip } from "@/components/journal/journal-month-strip"
import { JournalTradesList } from "@/components/journal/journal-trades-list"
import { JournalTradeCards } from "@/components/journal/journal-trade-cards"
import {
  buildDrawdownStats,
  buildJournalMonthStats,
  buildSessionPerformance,
  buildWeekdayPerformance,
  filterTradesForDate,
  formatJournalDayPnl,
} from "@/lib/journal/calendar-analytics"
import type { JournalViewMode } from "@/lib/journal/journal-workflow"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"
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
  const [journalMode, setJournalMode] = useState<JournalViewMode>("trades")
  const [plansById, setPlansById] = useState<Map<string, MatchableTradePlan>>(new Map())

  useEffect(() => {
    let cancelled = false
    async function loadPlans() {
      try {
        const res = await fetch("/api/trade-plans")
        const payload = await res.json().catch(() => ({}))
        if (cancelled) return
        const map = new Map<string, MatchableTradePlan>()
        for (const row of payload.plans ?? []) {
          map.set(String(row.id), {
            id: String(row.id),
            pair: String(row.pair),
            direction: row.direction,
            status: row.status,
            created_at: String(row.created_at),
            accountSize: Number(row.accountSize),
            entryPrice: Number(row.entryPrice),
            stopLoss: Number(row.stopLoss),
            takeProfit: Number(row.takeProfit),
            recommendedLots: row.recommendedLots != null ? Number(row.recommendedLots) : null,
            riskAmount: Number(row.riskAmount),
            rr: row.rr != null ? Number(row.rr) : null,
            riskPercent: Number(row.riskPercent),
          })
        }
        setPlansById(map)
      } catch {
        if (!cancelled) setPlansById(new Map())
      }
    }
    void loadPlans()
    return () => {
      cancelled = true
    }
  }, [trades.length])

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

  const hasPlannedInProgress = plannedSessions.some((s) => s.status === "in_progress")
  const hasTrades = trades.length > 0

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

  if (selectedDate) {
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
          <div className="vyronis-surface flex flex-wrap items-center gap-2 px-3 py-2">
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
              {selectedDayMeta.tradeCount} trades · {selectedDayMeta.winRate}% wins
            </span>
          </div>
        ) : null}

        {onLogTrade ? (
          <Button
            type="button"
            onClick={() => onLogTrade(selectedDate)}
            className="h-10 w-full btn-primary sm:w-auto"
          >
            <Plus className="mr-2 size-4" />
            Log trade
          </Button>
        ) : null}

        <JournalTradeCards
          trades={dayTrades as DashboardTradeRow[]}
          plansById={plansById}
          onEdit={onEditTrade}
          onDelete={onDeleteTrade}
          onViewTrade={onViewTrade}
        />
      </section>
    )
  }

  return (
    <section className="dashboard-section space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[15px] font-semibold tracking-tight text-foreground">Journal</p>
        <div className="flex w-full flex-col gap-2 sm:w-auto">{headerActions}</div>
      </div>

      <JournalModeTabs mode={journalMode} onChange={setJournalMode} />

      {journalMode === "trades" ? (
        <div className="space-y-3">
          {plannedSessions.length > 0 ? (
            <CollapsibleDashboardSection
              title="Planned setups"
              subtitle={hasPlannedInProgress ? "Coach in progress" : undefined}
              defaultOpen={hasPlannedInProgress}
              collapseOnMobile
            >
              <PlannedTradesSection
                variant="journal"
                sessions={plannedSessions}
                isLoading={isLoadingPlanned}
                deletingSessionId={deletingSessionId}
                onContinueCoach={onContinueCoach}
                onConvertToTrade={onConvertToTrade}
                onDeletePlanned={onDeletePlanned}
                onNewCoach={onNewCoach}
              />
            </CollapsibleDashboardSection>
          ) : null}
          <JournalTradesList
            trades={trades}
            onViewTrade={onViewTrade}
            onEdit={onEditTrade}
            onDelete={onDeleteTrade}
            onScreenshotClick={onScreenshotClick}
            onLogTrade={onLogTrade ? () => onLogTrade() : undefined}
          />
        </div>
      ) : null}

      {journalMode === "calendar" ? (
        <div className="space-y-3">
          <JournalMonthStrip stats={monthStats} />
          <JournalCalendarView
            trades={trades}
            viewYear={viewYear}
            viewMonth={viewMonth}
            onPrevMonth={goPrevMonth}
            onNextMonth={goNextMonth}
            onSelectDate={setSelectedDate}
            onLogTrade={onLogTrade ? () => onLogTrade() : undefined}
          />
          {hasTrades ? (
            <CollapsibleDashboardSection
              title="Recent trades"
              defaultOpen={false}
              collapseOnMobile
            >
              <DashboardRecentTradesSection
                trades={trades}
                limit={3}
                variant="compact"
                onViewTrade={onViewTrade}
                onEdit={onEditTrade}
                onDelete={onDeleteTrade}
                onScreenshotClick={onScreenshotClick}
              />
            </CollapsibleDashboardSection>
          ) : null}
          {plannedSessions.length > 0 ? (
            <CollapsibleDashboardSection
              title="Planned setups"
              subtitle={hasPlannedInProgress ? "Coach in progress" : undefined}
              defaultOpen={hasPlannedInProgress}
              collapseOnMobile
            >
              <PlannedTradesSection
                variant="journal"
                sessions={plannedSessions}
                isLoading={isLoadingPlanned}
                deletingSessionId={deletingSessionId}
                onContinueCoach={onContinueCoach}
                onConvertToTrade={onConvertToTrade}
                onDeletePlanned={onDeletePlanned}
                onNewCoach={onNewCoach}
              />
            </CollapsibleDashboardSection>
          ) : null}
        </div>
      ) : null}

      {journalMode === "analytics" && hasTrades ? (
        <JournalAnalyticsStrip drawdown={drawdown} sessions={sessionPerf} weekdays={weekdayPerf} />
      ) : null}

      {journalMode === "analytics" && !hasTrades ? (
        <DashboardEmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Log a trade to unlock session and weekday stats"
          className="min-h-[160px]"
        />
      ) : null}

      {journalMode === "intelligence" ? (
        <JournalIntelligenceMode trades={trades} maxRiskPerTrade={1} />
      ) : null}

      <div className="border-t border-white/[0.05] pt-2">
        <Link
          href="/war-room"
          className="text-[10px] font-medium text-muted-foreground/60 hover:text-cyan-glow"
        >
          War Room →
        </Link>
      </div>
    </section>
  )
}
