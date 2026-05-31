"use client"

import { useEffect, useState } from "react"
import {
  Activity,
  Brain,
  Loader2,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardInsetPanel,
} from "@/components/dashboard/dashboard-primitives"
import { Progress } from "@/components/ui/progress"
import { fetchLearningDashboard } from "@/lib/learning/api-client"
import type { LearningMemorySnapshot } from "@/lib/learning/types"
import { cn } from "@/lib/utils"
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type TradeLearningPanelProps = {
  refreshKey?: number
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "cyan",
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: typeof Brain
  tone?: "cyan" | "profit" | "caution"
}) {
  const toneClass =
    tone === "profit"
      ? "text-profit"
      : tone === "caution"
        ? "text-yellow-400"
        : "text-cyan-glow"

  return (
    <DashboardCard className="border-white/[0.06] bg-black/20">
      <DashboardCardBody className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/75">
            {title}
          </p>
          <Icon className={cn("size-3.5", toneClass)} />
        </div>
        <p className={cn("text-2xl font-semibold tabular-nums", toneClass)}>{value}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground/70">{subtitle}</p>}
      </DashboardCardBody>
    </DashboardCard>
  )
}

export function TradeLearningPanel({ refreshKey = 0 }: TradeLearningPanelProps) {
  const [snapshot, setSnapshot] = useState<LearningMemorySnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const result = await fetchLearningDashboard()
        if (!cancelled) setSnapshot(result)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load learning data")
          setSnapshot(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (isLoading) {
    return (
      <DashboardInsetPanel className="flex min-h-[120px] items-center justify-center border-cyan-glow/15 bg-cyan-glow/[0.03]">
        <Loader2 className="size-5 animate-spin text-cyan-glow" />
      </DashboardInsetPanel>
    )
  }

  if (error || !snapshot) {
    return (
      <DashboardInsetPanel className="border-yellow-500/20 bg-yellow-500/[0.04] px-3 py-3 text-[11px] text-muted-foreground/80">
        {error || "Learning engine unavailable. Run supabase/trade-memory-migration.sql."}
      </DashboardInsetPanel>
    )
  }

  const { dashboard } = snapshot
  const heatmapData = dashboard.mistakeHeatmap.slice(0, 6)
  const pairData = dashboard.winRateByPair.slice(0, 6)
  const winningPatterns = dashboard.winningPatterns.filter((pattern) => (pattern.winRate ?? 0) > 0)
  const bestSetupType =
    dashboard.bestSetupType && (dashboard.bestSetupType.winRate ?? 0) > 0
      ? dashboard.bestSetupType
      : null

  return (
    <div className="space-y-3">
      <DashboardInsetPanel className="border-cyan-glow/20 bg-cyan-glow/[0.04] px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-cyan-glow" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/90">
                Trade Memory + Learning
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                {dashboard.tradeMemoryCount} trades remembered · patterns update after each journal entry
              </p>
            </div>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground/70">
          Weekly reviews are generated and saved from the Weekly AI Review section above.
        </p>
      </DashboardInsetPanel>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Discipline Score"
          value={`${dashboard.disciplineScore}%`}
          subtitle="From coach feedback + rule adherence"
          icon={Shield}
        />
        <MetricCard
          title="Emotional Stability"
          value={`${dashboard.emotionalStability}%`}
          subtitle="Stable vs impulsive entry states"
          icon={Activity}
          tone={dashboard.emotionalStability >= 70 ? "profit" : "caution"}
        />
        <MetricCard
          title="HTF Alignment Accuracy"
          value={`${dashboard.htfAlignmentAccuracy}%`}
          subtitle="Trades aligned with higher-timeframe bias"
          icon={Target}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DashboardCard className="border-white/[0.06] bg-black/20">
          <DashboardCardHeader title="Best Setup Type" icon={Sparkles} className="px-3 py-2" />
          <DashboardCardBody className="space-y-2 px-3 pb-3">
            {bestSetupType ? (
              <>
                <p className="text-lg font-semibold text-foreground/90">{bestSetupType.value}</p>
                <p className="text-[11px] text-muted-foreground/75">{bestSetupType.message}</p>
                <div className="flex items-center gap-2 text-[10px] text-cyan-glow/80">
                  <TrendingUp className="size-3.5" />
                  {bestSetupType.winRate}% win rate · {bestSetupType.tradeCount} trades
                </div>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground/70">Log more trades to identify your edge.</p>
            )}
          </DashboardCardBody>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-black/20">
          <DashboardCardHeader title="Win Rate by Pair" icon={TrendingUp} className="px-3 py-2" />
          <DashboardCardBody className="h-44 px-2 pb-2">
            {pairData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pairData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <XAxis dataKey="pair" tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15,23,42,0.95)",
                      border: "1px solid rgba(34,211,238,0.2)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                    {pairData.map((entry) => (
                      <Cell
                        key={entry.pair}
                        fill={entry.winRate >= 55 ? "rgba(34,197,94,0.75)" : "rgba(248,113,113,0.75)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="px-2 text-[11px] text-muted-foreground/70">No pair stats yet.</p>
            )}
          </DashboardCardBody>
        </DashboardCard>
      </div>

      <DashboardCard className="border-white/[0.06] bg-black/20">
        <DashboardCardHeader title="Mistake Heatmap" icon={Activity} className="px-3 py-2" />
        <DashboardCardBody className="space-y-2 px-3 pb-3">
          {heatmapData.length > 0 ? (
            heatmapData.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-foreground/85">{item.label}</span>
                  <span className="tabular-nums text-muted-foreground/70">
                    {item.count}x · {item.lossRate}% loss
                  </span>
                </div>
                <Progress
                  value={Math.min(item.count * 12, 100)}
                  className="h-1.5 bg-white/[0.06]"
                />
              </div>
            ))
          ) : (
            <p className="text-[11px] text-muted-foreground/70">No repeated mistakes detected yet.</p>
          )}
        </DashboardCardBody>
      </DashboardCard>

      {winningPatterns.length > 0 && (
        <DashboardInsetPanel className="border-profit/15 bg-profit/[0.03] px-3 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-profit/90">
            Winning Conditions
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {winningPatterns.slice(0, 4).map((pattern) => (
              <div key={pattern.key} className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-2">
                <p className="text-[10px] font-medium text-foreground/85">{pattern.label}</p>
                <p className="text-[10px] text-muted-foreground/75">{pattern.message}</p>
              </div>
            ))}
          </div>
        </DashboardInsetPanel>
      )}

      {dashboard.recurringPatterns.length > 0 && (
        <DashboardInsetPanel className="border-loss/15 bg-loss/[0.03] px-3 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-loss/90">
            Recurring Behaviors
          </p>
          <ul className="space-y-1 text-[10px] text-muted-foreground/80">
            {dashboard.recurringPatterns.slice(0, 5).map((pattern) => (
              <li key={pattern.key}>• {pattern.message}</li>
            ))}
          </ul>
        </DashboardInsetPanel>
      )}
    </div>
  )
}
