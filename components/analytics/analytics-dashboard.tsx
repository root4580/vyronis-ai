"use client"

import Link from "next/link"
import {
  AlertTriangle,
  BarChart3,
  Clock,
  Percent,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { APP_HOME_PATH } from "@/lib/branding"
import { AnalyticsEmotionChart } from "@/components/analytics/analytics-emotion-chart"
import { AnalyticsEquityChart } from "@/components/analytics/analytics-equity-chart"
import { AnalyticsMetricCard } from "@/components/analytics/analytics-metric-card"
import { AnalyticsSetupBreakdown } from "@/components/analytics/analytics-setup-breakdown"
import { AnalyticsWeeklyTrend } from "@/components/analytics/analytics-weekly-trend"
import { DashboardEmptyState } from "@/components/dashboard/dashboard-primitives"
import type { DashboardAnalyticsSnapshot } from "@/lib/analytics/types"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import { formatAverageRiskReward } from "@/lib/trade-form-utils"

type AnalyticsDashboardProps = {
  analytics: DashboardAnalyticsSnapshot
  startingBalance: number
}

export function AnalyticsDashboard({ analytics, startingBalance }: AnalyticsDashboardProps) {
  if (!analytics.hasData) {
    return (
      <DashboardEmptyState
        icon={BarChart3}
        title="No trades to analyze yet"
        description="Log your first trade in the journal to unlock Vyronis performance analytics, equity curves, and coaching insights."
        className="min-h-[420px] rounded-2xl border border-white/[0.06] bg-black/20"
      >
        <Button asChild size="sm" className="mt-4 btn-primary">
          <Link href={`${APP_HOME_PATH}?action=new-trade`}>Log your first trade</Link>
        </Button>
      </DashboardEmptyState>
    )
  }

  const pnlFormatted = formatPnL(analytics.totalPnL, analytics.totalPnL >= 0 ? "WIN" : "LOSS")
  const pnlTone = analytics.totalPnL >= 0 ? "profit" : "loss"

  return (
    <div className="space-y-6 md:space-y-8">
      <div id="analytics-overview" className="scroll-mt-24 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsMetricCard
          label="Win Rate"
          value={`${analytics.winRate}%`}
          subtext={`${analytics.wins}W · ${analytics.losses}L across ${analytics.tradeCount} trades`}
          icon={Percent}
          tone="cyan"
          delayMs={0}
        />
        <AnalyticsMetricCard
          label="Total P&L"
          value={pnlFormatted}
          subtext="Net realized performance"
          icon={TrendingUp}
          tone={pnlTone}
          delayMs={60}
        />
        <AnalyticsMetricCard
          label="Average R:R"
          value={formatAverageRiskReward(analytics.averageRR)}
          subtext={
            analytics.averageRR > 0
              ? "Mean planned risk-reward on logged trades"
              : "Add entry, stop, and target to calculate R:R"
          }
          icon={Target}
          tone="cyan"
          delayMs={120}
        />
        <AnalyticsMetricCard
          label="Best Session"
          value={analytics.bestSession?.name ?? "—"}
          subtext={
            analytics.bestSession
              ? `${formatPnL(analytics.bestSession.pnl, "WIN")} · ${analytics.bestSession.winRate}% WR`
              : "No profitable session yet — keep logging"
          }
          icon={Clock}
          tone={analytics.bestSession && analytics.bestSession.pnl >= 0 ? "profit" : "default"}
          delayMs={180}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsMetricCard
          label="Best Pair"
          value={analytics.bestPair?.pair ?? "—"}
          subtext={
            analytics.bestPair
              ? `${formatPnL(analytics.bestPair.pnl, analytics.bestPair.pnl >= 0 ? "WIN" : "LOSS")} · ${analytics.bestPair.tradeCount} trades`
              : "Diversify across instruments"
          }
          icon={Trophy}
          tone={analytics.bestPair && analytics.bestPair.pnl >= 0 ? "profit" : "default"}
          delayMs={240}
        />
        <AnalyticsMetricCard
          label="Top Mistake"
          value={analytics.topMistake?.label ?? "None"}
          subtext={
            analytics.topMistake
              ? `${analytics.topMistake.count} occurrences · ${analytics.topMistake.frequency}% frequency`
              : "Clean mistake profile"
          }
          icon={AlertTriangle}
          tone={analytics.topMistake ? "loss" : "profit"}
          delayMs={300}
        />
        <AnalyticsMetricCard
          label="Journal Size"
          value={String(analytics.tradeCount)}
          subtext="Total trades in analytics scope"
          icon={BarChart3}
          delayMs={360}
        />
        <AnalyticsMetricCard
          label="Net Result"
          value={analytics.totalPnL >= 0 ? "Profitable" : "Drawdown"}
          subtext={
            <span className={getPnLTextClass(analytics.totalPnL, analytics.totalPnL >= 0 ? "WIN" : "LOSS")}>
              {pnlFormatted} cumulative
            </span>
          }
          icon={TrendingUp}
          tone={pnlTone}
          delayMs={420}
        />
      </div>

      <div id="analytics-charts" className="scroll-mt-24 grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        <AnalyticsEquityChart data={analytics.equityCurve} startingBalance={startingBalance} />
        <AnalyticsWeeklyTrend data={analytics.weeklyTrend} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:gap-4">
        <AnalyticsSetupBreakdown data={analytics.setupBreakdown} />
        <AnalyticsEmotionChart data={analytics.emotionFrequency} />
      </div>
    </div>
  )
}
