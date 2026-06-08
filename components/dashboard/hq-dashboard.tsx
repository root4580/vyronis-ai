"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Bot,
  X,
} from "lucide-react"
import type { DashboardTradeRow } from "@/components/dashboard/trading-components"
import { fetchWeeklyPlan } from "@/lib/strategy-brain/api-client"
import type { WeeklyPlanWithPairs } from "@/lib/strategy-brain/types"
import { isWatchlistComplete } from "@/lib/strategy-brain/weekly-watchlist"
import type { PlanDisciplineAggregate } from "@/lib/trade-planner/plan-discipline-aggregate"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"
import type { PlanDisciplineGrade } from "@/lib/trade-planner/deviation-engine"
import { computePlanStreak, disciplineGradeBoxClass } from "@/lib/trade-planner/plan-streak"
import { getForexSessionHeaderState } from "@/lib/trading/forex-sessions"
import {
  computeAvgRiskReward,
  formatHeaderDate,
  getTimeOfDayGreeting,
} from "@/lib/hq-dashboard-metrics"
import { formatPnL, getPnLTextClass, getSignedPnL } from "@/lib/trade-utils"
import { getDashboardTabHref } from "@/lib/dashboard-nav"
import { cn } from "@/lib/utils"
import { AccountStatusCard } from "@/components/dashboard/account-status-card"
import { TradingRulesDashboardCard } from "@/components/dashboard/trading-rules-dashboard-card"
import { fetchWeeklyChapterDashboard } from "@/lib/weekly-chapters/api-client"
import { WeeklyChapterSystem } from "@/components/weekly-chapters/weekly-chapter-system"
import { ForexSessionsWidget } from "@/components/dashboard/forex-sessions-widget"
import { EconomicNewsPreview } from "@/components/economic-calendar/economic-news-preview"
import { DailyClosePanel } from "@/components/journal/daily-close-panel"
import { getTodayTrades } from "@/lib/user-settings"
import type { TradingAccountRecord } from "@/lib/accounts/types"
import type { UserSettingsForm } from "@/lib/user-settings"
import type { TradingRulesSnapshot } from "@/lib/trading-rules/types"

type HqDashboardProps = {
  trades: DashboardTradeRow[]
  winRate: number
  activeAccount: TradingAccountRecord
  settings?: UserSettingsForm | null
  onOpenCoach: () => void
  onOpenWarRoom: () => void
  onOpenJournal: () => void
  onOpenPlanner: (pair?: string) => void
  onViewTrade: (trade: DashboardTradeRow) => void
  onOpenSettings?: () => void
  tradingRulesSnapshot?: TradingRulesSnapshot | null
  traderFirstName?: string | null
  className?: string
}

function BiasBadge({ bias }: { bias: string }) {
  const normalized = bias?.toLowerCase() ?? "neutral"
  if (normalized.includes("bull")) {
    return (
      <span className="rounded-[var(--radius-sm)] border border-profit/20 bg-profit/10 px-[7px] py-[2px] text-[10px] font-medium text-profit">
        Bull
      </span>
    )
  }
  if (normalized.includes("bear")) {
    return (
      <span className="rounded-[var(--radius-sm)] border border-loss/25 bg-loss/10 px-[7px] py-[2px] text-[10px] font-medium text-loss">
        Bear
      </span>
    )
  }
  return (
    <span className="rounded-[var(--radius-sm)] border border-white/[0.08] bg-white/[0.05] px-[7px] py-[2px] text-[10px] font-medium text-text-secondary">
      Neut
    </span>
  )
}

function HqStatCard({
  label,
  value,
  sub,
  valueClassName,
}: {
  label: string
  value: string
  sub?: string
  valueClassName?: string
}) {
  return (
    <div className="hq-surface-card px-[14px] py-3">
      <p className="section-label mb-1.5">{label}</p>
      <p className={cn("text-[22px] font-medium tabular-nums text-text-primary", valueClassName)}>{value}</p>
      {sub ? <p className="mt-1 text-[11px] text-text-muted">{sub}</p> : null}
    </div>
  )
}

export function HqDashboard({
  trades,
  winRate,
  activeAccount,
  settings,
  onOpenCoach,
  onOpenWarRoom,
  onOpenJournal,
  onOpenPlanner,
  onViewTrade,
  onOpenSettings,
  tradingRulesSnapshot,
  traderFirstName,
  className,
}: HqDashboardProps) {
  const [weekPlan, setWeekPlan] = useState<WeeklyPlanWithPairs | null>(null)
  const [discipline, setDiscipline] = useState<PlanDisciplineAggregate | null>(null)
  const [chapterDisciplineScore, setChapterDisciplineScore] = useState<number | null>(null)
  const [chapterDisciplineGrade, setChapterDisciplineGrade] = useState<string | null>(null)
  const [plansById, setPlansById] = useState<Map<string, MatchableTradePlan>>(new Map())
  const [coachNudgeDismissed, setCoachNudgeDismissed] = useState(false)

  useEffect(() => {
    void fetchWeeklyPlan().then(setWeekPlan).catch(() => setWeekPlan(null))
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchWeeklyChapterDashboard({
      accountId: activeAccount.id,
      traderFirstName,
    })
      .then((dashboard) => {
        if (cancelled) return
        setChapterDisciplineScore(dashboard.thisWeek.disciplineScore)
        setChapterDisciplineGrade(dashboard.thisWeek.disciplineGrade)
      })
      .catch(() => {
        if (!cancelled) {
          setChapterDisciplineScore(null)
          setChapterDisciplineGrade(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [activeAccount.id, traderFirstName])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const accountQuery = activeAccount.id ? `?accountId=${encodeURIComponent(activeAccount.id)}` : ""
        const [summaryRes, plansRes] = await Promise.all([
          fetch(`/api/trade-planner/discipline-summary${accountQuery}`),
          fetch(`/api/trade-plans${accountQuery}`),
        ])
        const summary = await summaryRes.json().catch(() => ({}))
        const plansPayload = await plansRes.json().catch(() => ({}))
        if (cancelled) return
        setDiscipline(summary.aggregate ?? null)
        const map = new Map<string, MatchableTradePlan>()
        for (const row of plansPayload.plans ?? []) {
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
        if (!cancelled) {
          setDiscipline(null)
          setPlansById(new Map())
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [trades.length, activeAccount.id])

  const [marketNow, setMarketNow] = useState(() => new Date())

  useEffect(() => {
    const refresh = () => setMarketNow(new Date())
    refresh()
    const id = window.setInterval(refresh, 1000)
    return () => window.clearInterval(id)
  }, [])

  const forexHeader = useMemo(() => getForexSessionHeaderState(marketNow), [marketNow])
  const { average: avgRr, plannedAverage } = useMemo(() => computeAvgRiskReward(trades), [trades])
  const totalPnL = useMemo(
    () => trades.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0),
    [trades],
  )
  const streak = useMemo(
    () =>
      computePlanStreak({
        trades: trades.map((t) => ({
          id: t.id,
          plan_id: t.plan_id ?? null,
          pair: t.pair,
          direction: t.direction,
          result: t.result,
          pnl: t.pnl,
          trade_date: t.trade_date,
          created_at: t.created_at,
          entry_price: t.entry_price,
          stop_loss: t.stop_loss,
          take_profit: t.take_profit,
          risk_percent: t.risk_percent,
          risk_reward: t.risk_reward,
        })),
        plansById,
      }),
    [trades, plansById],
  )

  const watchlistReady = isWatchlistComplete(weekPlan)
  const showCoachNudge = !coachNudgeDismissed && !watchlistReady
  const recentTrades = useMemo(() => {
    return [...trades]
      .sort((a, b) => (b.trade_date ?? b.created_at).localeCompare(a.trade_date ?? a.created_at))
      .slice(0, 6)
  }, [trades])

  const todayTrades = useMemo(() => getTodayTrades(trades), [trades])
  const todayWinCount = useMemo(
    () => todayTrades.filter((trade) => trade.result === "WIN").length,
    [todayTrades],
  )
  const todayLossCount = useMemo(
    () => todayTrades.filter((trade) => trade.result === "LOSS").length,
    [todayTrades],
  )

  const disciplineScore = chapterDisciplineScore ?? discipline?.weekAverageScore
  const disciplineGrade = chapterDisciplineGrade ?? discipline?.weekGrade

  const headerAccent = forexHeader.accent
  const headerBackground = `rgb(from ${headerAccent} r g b / 0.08)`
  const headerMuted = `rgb(from ${headerAccent} r g b / 0.62)`

  return (
    <div className={cn("space-y-5", className)}>
      <EconomicNewsPreview />

      <AccountStatusCard
        trades={trades}
        account={activeAccount}
        settings={settings}
        onOpenSettings={onOpenSettings}
        className="md:hidden"
      />

      <WeeklyChapterSystem
        accountId={activeAccount.id}
        traderFirstName={traderFirstName}
        disciplineScore={disciplineScore ?? null}
        disciplineGrade={disciplineGrade ?? null}
        tradingRulesSnapshot={tradingRulesSnapshot ?? null}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-medium text-text-primary">{getTimeOfDayGreeting()}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[11px] text-text-muted">
            <span>{formatHeaderDate()}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{
                  background: headerAccent,
                  boxShadow: forexHeader.isLive ? `0 0 0 2px ${headerBackground}` : undefined,
                }}
                aria-hidden="true"
              />
              <span style={{ color: headerAccent }}>{forexHeader.primaryLabel}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span style={{ color: headerMuted }}>{forexHeader.secondaryLabel}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:items-stretch">
        <HqStatCard label="Win rate" value={`${winRate}%`} sub={`${trades.length} trades`} />
        <HqStatCard
          label="Avg R:R"
          value={avgRr != null ? `${avgRr.toFixed(1)}R` : "—"}
          sub={plannedAverage != null ? `planned ${plannedAverage.toFixed(1)}R` : "no planned setups"}
        />
        <HqStatCard
          label="P&L"
          value={formatPnL(totalPnL, totalPnL >= 0 ? "WIN" : "LOSS")}
          valueClassName={getPnLTextClass(totalPnL, totalPnL >= 0 ? "WIN" : "LOSS")}
          sub="all time"
        />
        <AccountStatusCard
          trades={trades}
          account={activeAccount}
          settings={settings}
          onOpenSettings={onOpenSettings}
          className="hidden md:flex"
        />
      </div>

      <TradingRulesDashboardCard snapshot={tradingRulesSnapshot ?? null} />

      {showCoachNudge ? (
        <div
          className="relative rounded-[var(--radius-md)] border px-3 py-3"
          style={{
            background: "rgb(from var(--color-accent) r g b / 0.04)",
            borderColor: "var(--color-accent-border)",
          }}
        >
          <button
            type="button"
            onClick={() => setCoachNudgeDismissed(true)}
            className="absolute right-2 top-2 text-text-muted hover:text-text-primary"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
          <div className="flex gap-3 pr-6">
            <div
              className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
              style={{ background: "var(--color-accent-bg)" }}
            >
              <Bot className="size-3.5 text-text-accent" />
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-xs leading-relaxed text-text-secondary">
                <span className="font-medium text-text-primary">Set your War Room watchlist</span> before
                the session — Coach works best with a weekly plan.
              </p>
              <button
                type="button"
                onClick={onOpenWarRoom}
                className="inline-flex items-center rounded-[var(--radius-sm)] border px-2.5 py-1 text-[11px] text-text-accent"
                style={{
                  background: "var(--color-accent-bg)",
                  borderColor: "var(--color-accent-border)",
                }}
              >
                Open War Room
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="hq-surface-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3.5 py-3">
            <p className="section-label">Watchlist</p>
            <Link href="/war-room" className="text-[11px] text-text-accent hover:underline">
              War Room →
            </Link>
          </div>
          <div className="mx-3 mb-3 mt-3">
            <ForexSessionsWidget />
          </div>
          <div className="divide-y divide-[var(--border-subtle)] px-3 py-1">
            {(weekPlan?.pairs ?? []).length === 0 ? (
              <p className="py-4 text-[11px] text-text-muted">No pairs on this week&apos;s watchlist.</p>
            ) : (
              weekPlan?.pairs.map((pair) => (
                <div key={pair.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <span className="min-w-[64px] text-xs font-medium text-text-primary">{pair.pair}</span>
                  <BiasBadge bias={pair.directional_bias} />
                  <span className="ml-auto text-[11px] text-text-muted">
                    {pair.aoi_low != null && pair.aoi_high != null
                      ? `${pair.aoi_low} – ${pair.aoi_high}`
                      : "AOI pending"}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenPlanner(pair.pair)}
                    className="rounded-[var(--radius-sm)] border px-[7px] py-[2px] text-[10px] text-text-accent"
                    style={{
                      background: "var(--color-accent-bg)",
                      borderColor: "var(--color-accent-border)",
                    }}
                  >
                    Plan
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="hq-surface-card p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <p className="section-label">Discipline</p>
              <span className="text-[11px] text-text-muted">This week</span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] border text-lg font-semibold",
                  disciplineGradeBoxClass((disciplineGrade as PlanDisciplineGrade | null) ?? null),
                )}
              >
                {disciplineGrade ?? "—"}
              </div>
              <div>
                <p className="text-lg font-medium tabular-nums text-text-primary">
                  {disciplineScore ?? "—"}
                </p>
                <p className="text-[11px] text-text-muted">
                  avg across {discipline?.weekTradeCount ?? 0} linked trades
                </p>
              </div>
            </div>
            {disciplineScore != null ? (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[10px] text-text-muted">
                  <span>Score</span>
                  <span>{disciplineScore}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-sm bg-white/[0.06]">
                  <div
                    className="h-full bg-profit transition-all"
                    style={{ width: `${Math.min(100, disciplineScore)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="hq-surface-card p-3.5">
            <p className="section-label mb-2">Plan streak</p>
            <p className="text-[28px] font-medium tabular-nums text-text-accent">{streak.streakCount}</p>
            <p className="text-[11px] text-text-muted">consecutive trades following plan</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {streak.dots.length === 0 ? (
                <span className="text-[11px] text-text-muted">Log linked trades to track streak</span>
              ) : (
                streak.dots.map((dot, index) => (
                  <span
                    key={`${dot}-${index}`}
                    className={cn(
                      "size-2 rounded-[2px]",
                      dot === "on" && "bg-profit",
                      dot === "off" && "bg-loss/30",
                      dot === "unlinked" && "bg-white/10",
                    )}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <DailyClosePanel
        accountId={activeAccount.id}
        todayTradeCount={todayTrades.length}
        todayWinCount={todayWinCount}
        todayLossCount={todayLossCount}
        compact
      />

      <div className="hq-surface-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3.5 py-3">
          <p className="section-label">Recent trades</p>
          <button
            type="button"
            onClick={onOpenJournal}
            className="inline-flex items-center gap-1 text-[11px] text-text-accent hover:underline"
          >
            Journal
            <ArrowRight className="size-3" />
          </button>
        </div>
        {recentTrades.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-sm text-text-secondary">No trades logged yet</p>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {recentTrades.map((trade) => {
              const pnl = getSignedPnL(trade.pnl, trade.result)
              const isBuy = trade.direction?.toUpperCase().includes("BUY") || trade.direction?.toUpperCase() === "LONG"
              return (
                <button
                  key={trade.id}
                  type="button"
                  onClick={() => onViewTrade(trade)}
                  className="flex w-full flex-wrap items-center gap-2 px-3.5 py-3 text-left transition-colors hover:bg-white/[0.02]"
                >
                  <span className="min-w-[60px] text-xs font-medium text-text-primary">{trade.pair}</span>
                  <span
                    className={cn(
                      "rounded-[3px] px-1.5 py-[1px] text-[10px] font-medium",
                      isBuy
                        ? "border border-profit/20 bg-profit/10 text-profit"
                        : "border border-loss/25 bg-loss/10 text-loss",
                    )}
                  >
                    {isBuy ? "BUY" : "SELL"}
                  </span>
                  <span className="text-[11px] text-text-muted">{trade.session ?? "—"}</span>
                  <span className={cn("ml-auto text-xs font-medium tabular-nums", getPnLTextClass(pnl, trade.result))}>
                    {formatPnL(pnl, trade.result)}
                  </span>
                  {trade.plan_id ? (
                    <span
                      className="rounded-[3px] px-1.5 py-[1px] text-[10px] text-text-accent"
                      style={{ background: "rgb(from var(--color-accent) r g b / 0.08)" }}
                    >
                      Plan
                    </span>
                  ) : null}
                  <span className="min-w-[40px] text-right text-[10px] tabular-nums text-text-muted">
                    {trade.trade_date?.slice(5) ?? "—"}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
