"use client"

import dynamic from "next/dynamic"
import { DashboardOverviewSkeleton } from "@/components/dashboard/dashboard-skeletons"

export const LazyJournalCommandCenter = dynamic(
  () =>
    import("@/components/journal/journal-command-center").then((m) => ({
      default: m.JournalCommandCenter,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[240px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
    ),
  },
)

export const LazyWeeklyDebriefPanel = dynamic(
  () =>
    import("@/components/dashboard/weekly-debrief-panel").then((m) => ({
      default: m.WeeklyDebriefPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[120px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
    ),
  },
)

export const LazyEquityCurveChart = dynamic(
  () =>
    import("@/components/dashboard/trading-components").then((m) => ({
      default: m.EquityCurveChart,
    })),
  {
    ssr: false,
    loading: () => <DashboardOverviewSkeleton />,
  },
)

export const LazyWeeklyPerformance = dynamic(
  () =>
    import("@/components/dashboard/trading-components").then((m) => ({
      default: m.WeeklyPerformance,
    })),
  { ssr: false,
    loading: () => (
      <div className="min-h-[200px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
    ),
  },
)

export const LazyStrategyPerformance = dynamic(
  () =>
    import("@/components/dashboard/strategy-performance").then((m) => ({
      default: m.StrategyPerformance,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[160px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
    ),
  },
)
