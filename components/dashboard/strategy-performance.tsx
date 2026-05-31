"use client"

import { useEffect, useMemo } from "react"
import { Crown, Layers, Target, TrendingDown, TrendingUp, Zap, AlertTriangle, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardEmptyState,
  DashboardInsetPanel,
} from "@/components/dashboard/dashboard-primitives"
import {
  buildStrategyPerformance,
  formatAvgRR,
  formatStrategyPnL,
  type StrategyStats,
  type StrategyTrade,
} from "@/lib/strategy-performance"
import { buildMistakeAnalysis, type MistakeTrade } from "@/lib/mistake-analysis"
import { formatTradeResultLabel } from "@/lib/trade-utils"
import { StrategyPerformanceSkeleton } from "@/components/dashboard/dashboard-skeletons"
import {
  collectStrategyNamesFromTrades,
  StrategyNameSelect,
} from "@/components/dashboard/strategy-name-select"

type StrategyPerformanceProps = {
  trades?: (StrategyTrade & Partial<MistakeTrade>)[]
  isLoading?: boolean
  loadError?: string | null
  onPlanTrade?: () => void
  onAssignStrategy?: (tradeId: string, strategyName: string) => Promise<void> | void
}

function StrategyHighlightCard({
  label,
  strategy,
  tone,
  icon: Icon,
}: {
  label: string
  strategy: StrategyStats | null
  tone: "best" | "worst"
  icon: typeof Crown
}) {
  const isBest = tone === "best"

  return (
    <div
      className={`strategy-card group rounded-xl border p-3 transition-all duration-300 hover:-translate-y-0.5 ${
        isBest
          ? "border-profit/25 bg-profit/[0.06] hover:border-profit/40 hover:shadow-[0_0_24px_rgb(from var(--color-profit) r g b / 0.12)]"
          : "border-loss/25 bg-loss/[0.06] hover:border-loss/40 hover:shadow-[0_0_24px_rgb(from var(--color-loss) r g b / 0.12)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground/70">{label}</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {strategy?.name ?? "—"}
          </p>
        </div>
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${
            isBest
              ? "border-profit/20 bg-profit/10 text-profit"
              : "border-loss/20 bg-loss/10 text-loss"
          }`}
        >
          <Icon className="size-4" />
        </div>
      </div>
      {strategy && (
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className={`font-semibold tabular-nums ${isBest ? "text-profit" : "text-loss"}`}>
            {formatStrategyPnL(strategy.totalPnL)}
          </span>
          <span className="text-muted-foreground/70">{strategy.winRate}% WR</span>
        </div>
      )}
    </div>
  )
}

function StrategyRow({ strategy, index }: { strategy: StrategyStats; index: number }) {
  const pnlPositive = strategy.totalPnL >= 0
  const progressColor =
    strategy.winRate >= 50
      ? "[&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-profit/70 [&_[data-slot=progress-indicator]]:to-profit"
      : "[&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-loss/70 [&_[data-slot=progress-indicator]]:to-loss"

  return (
    <div
      className="strategy-row rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-all duration-300 hover:border-cyan-glow/20 hover:bg-cyan-glow/[0.03] hover:shadow-[0_0_20px_rgb(from var(--color-accent) r g b / 0.08)]"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(140px,1.4fr)_repeat(4,minmax(0,1fr))] lg:items-center lg:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-cyan-glow/15 bg-cyan-glow/[0.08]">
              <Layers className="size-3.5 text-cyan-glow" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{strategy.name}</p>
              <p className="text-[11px] text-muted-foreground/70">
                {strategy.tradeCount} trade{strategy.tradeCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground/70 lg:hidden">Win Rate</span>
            <span className="hidden text-muted-foreground/70 lg:inline">&nbsp;</span>
            <span
              className={`font-semibold tabular-nums ${
                strategy.winRate >= 50 ? "text-profit" : "text-loss"
              }`}
            >
              {strategy.winRate}%
            </span>
          </div>
          <Progress value={strategy.winRate} className={`h-1.5 bg-white/[0.05] ${progressColor}`} />
        </div>

        <div>
          <p className="section-label text-muted-foreground/60">Total P&L</p>
          <p
            className={`mt-1 text-sm font-semibold tabular-nums ${
              pnlPositive ? "text-profit" : "text-loss"
            }`}
          >
            {formatStrategyPnL(strategy.totalPnL)}
          </p>
        </div>

        <div>
          <p className="section-label text-muted-foreground/60">Avg RR</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-cyan-glow">
            {formatAvgRR(strategy.avgRR)}
          </p>
        </div>

        <div>
          <p className="section-label text-muted-foreground/60">Record</p>
          <p className="mt-1 text-sm font-medium tabular-nums">
            <span className="text-profit">{strategy.wins}W</span>
            <span className="text-muted-foreground/40"> / </span>
            <span className="text-loss">{strategy.losses}L</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export function StrategyPerformance({
  trades,
  isLoading = false,
  loadError = null,
  onPlanTrade,
  onAssignStrategy,
}: StrategyPerformanceProps) {
  const safeTrades = trades ?? []
  const summary = useMemo(() => buildStrategyPerformance(safeTrades), [safeTrades])
  const strategyNameOptions = useMemo(() => collectStrategyNamesFromTrades(safeTrades), [safeTrades])
  const unassignedTrades = useMemo(
    () =>
      safeTrades.filter(
        (trade) => trade.id && !trade.strategy_name?.trim(),
      ) as Array<StrategyTrade & { id: string; pair?: string }>,
    [safeTrades],
  )
  const unassignedStrategy = summary.strategies.find((strategy) => strategy.name === "Unassigned")
  const unassignedPercent =
    summary.totalTrades > 0 && unassignedStrategy
      ? (unassignedStrategy.tradeCount / summary.totalTrades) * 100
      : 0
  const showUnassignedBanner = unassignedPercent > 50
  const mistakeAnalysis = useMemo(
    () => buildMistakeAnalysis(safeTrades as MistakeTrade[]),
    [safeTrades],
  )

  useEffect(() => {
    console.log("[Vyronis Dashboard] StrategyPerformance:render", {
      isLoading,
      loadError,
      tradesCount: safeTrades.length,
    })
  }, [isLoading, loadError, safeTrades.length])

  if (isLoading) {
    return <StrategyPerformanceSkeleton />
  }

  if (loadError && safeTrades.length === 0) {
    return (
      <DashboardCard interactive glow className="overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-glow/[0.04] via-transparent to-loss/[0.03]" />
        <DashboardCardHeader title="Strategy Performance" icon={Target} />
        <DashboardCardBody>
          <DashboardEmptyState
            icon={AlertTriangle}
            title="Couldn't load strategy data"
            description={loadError}
            className="min-h-[220px]"
          />
        </DashboardCardBody>
      </DashboardCard>
    )
  }

  if (summary.totalTrades === 0) {
    return (
      <DashboardCard interactive glow className="overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-glow/[0.04] via-transparent to-profit/[0.03]" />
        <DashboardCardHeader title="Strategy Performance" icon={Target} />
        <DashboardCardBody>
          <DashboardEmptyState
            icon={Target}
            title="No strategy data yet"
            description="Log trades with a strategy name to unlock performance analytics"
            className="min-h-[220px]"
          />
        </DashboardCardBody>
      </DashboardCard>
    )
  }

  return (
    <DashboardCard interactive glow className="overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-glow/[0.05] via-transparent to-profit/[0.04]" />
      <DashboardCardHeader
        title="Strategy Performance"
        icon={Target}
        badge={
          <Badge
            variant="outline"
            className="h-5 border-cyan-glow/25 bg-cyan-glow/[0.08] text-[9px] font-semibold tracking-wider text-cyan-glow"
          >
            {summary.strategies.length} strategies
          </Badge>
        }
      />
      <DashboardCardBody className="relative space-y-4">
        {loadError && (
          <DashboardInsetPanel className="border-warning/15 bg-warning/[0.05] px-3 py-2.5">
            <p className="text-[11px] leading-relaxed text-muted-foreground/85">{loadError}</p>
          </DashboardInsetPanel>
        )}

        {!summary.hasStrategyData && !showUnassignedBanner && (
          <DashboardInsetPanel className="border-warning/15 bg-warning/[0.05] px-3 py-2.5">
            <p className="text-[11px] leading-relaxed text-muted-foreground/85">
              Assign strategy names when logging trades for sharper analytics. Showing unassigned trades for now.
            </p>
          </DashboardInsetPanel>
        )}

        {showUnassignedBanner ? (
          <DashboardInsetPanel className="border-warning/20 bg-warning/[0.07] px-4 py-3">
            <p className="text-[12px] font-medium text-foreground/90">
              Most of your trades have no strategy assigned.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">
              Add strategy names when planning setups to unlock this dashboard.
            </p>
            {onPlanTrade ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 border-cyan-glow/25 text-cyan-glow hover:bg-cyan-glow/[0.08]"
                onClick={onPlanTrade}
              >
                Plan a setup with strategy
                <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            ) : null}
          </DashboardInsetPanel>
        ) : null}

        {unassignedTrades.length > 0 && onAssignStrategy ? (
          <DashboardInsetPanel className="space-y-3 border-white/[0.08] px-4 py-3">
            <div>
              <p className="text-[12px] font-medium text-foreground/90">Assign strategy to past trades</p>
              <p className="mt-1 text-[11px] text-muted-foreground/75">
                Update unassigned journal rows inline — changes save immediately.
              </p>
            </div>
            <div className="space-y-2">
              {unassignedTrades.slice(0, 12).map((trade) => (
                <div
                  key={trade.id}
                  className="grid gap-2 rounded-lg border border-white/[0.06] bg-black/20 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,240px)] sm:items-center"
                >
                  <div>
                    <p className="text-[12px] font-medium text-foreground/90">{trade.pair ?? "Trade"}</p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {formatTradeResultLabel(trade.result)} · {formatStrategyPnL(trade.pnl)}
                    </p>
                  </div>
                  <StrategyNameSelect
                    value=""
                    existingNames={strategyNameOptions}
                    onChange={(strategyName) => {
                      if (!strategyName.trim()) return
                      void onAssignStrategy(trade.id, strategyName.trim())
                    }}
                    className="add-trade-input h-9 w-full"
                  />
                </div>
              ))}
            </div>
          </DashboardInsetPanel>
        ) : null}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {!summary.hasStrategyData ? (
            <DashboardInsetPanel className="sm:col-span-2 border-white/[0.08] px-4 py-4">
              <p className="text-[12px] font-medium text-foreground/90">No strategy data yet</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/75">
                Assign strategies when logging trades to unlock best/worst strategy insights.
              </p>
            </DashboardInsetPanel>
          ) : (
            <>
              <StrategyHighlightCard
                label="Best strategy"
                strategy={summary.bestStrategy}
                tone="best"
                icon={Crown}
              />
              <StrategyHighlightCard
                label="Worst strategy"
                strategy={summary.worstStrategy}
                tone="worst"
                icon={TrendingDown}
              />
            </>
          )}
        </div>

        <div className="hidden lg:grid lg:grid-cols-[minmax(140px,1.4fr)_repeat(4,minmax(0,1fr))] lg:gap-4 lg:px-3 lg:text-[10px] lg:font-medium lg:text-muted-foreground/60 [&_p]:section-label">
          <span>Strategy</span>
          <span>Win Rate</span>
          <span>Total P&L</span>
          <span>Avg RR</span>
          <span>Record</span>
        </div>

        <div className="space-y-2">
          {summary.strategies.map((strategy, index) => (
            <StrategyRow key={strategy.name} strategy={strategy} index={index} />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[10px] text-muted-foreground/70">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="size-3 text-profit" />
            <span>{summary.totalTrades} total trades analyzed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="size-3 text-cyan-glow" />
            <span>Avg RR = average win size ÷ average loss size</span>
          </div>
        </div>

        {mistakeAnalysis.strategyInsight && (
          <DashboardInsetPanel className="border-warning/15 bg-warning/[0.05] px-3 py-2.5">
            <p className="section-label text-warning-foreground/80">Mistake link</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/85">{mistakeAnalysis.strategyInsight}</p>
          </DashboardInsetPanel>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}
