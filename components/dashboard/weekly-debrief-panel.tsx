"use client"

import { useEffect, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  Brain,
  CalendarRange,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardInsetPanel,
  CHART_AXIS,
  CHART_GRID,
  CHART_TOOLTIP_STYLE,
} from "@/components/dashboard/dashboard-primitives"
import { fetchWeeklyDebrief } from "@/lib/ai/api-client"
import {
  copyWeeklyDebriefReport,
  formatWeeklyDebriefReport,
  printWeeklyDebriefReport,
} from "@/lib/ai/weekly-debrief-export"
import type { WeeklyDebriefResult } from "@/lib/ai/weekly-debrief-types"
import { getBestTradeHighlightLabel } from "@/lib/analytics/insight-thresholds"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import { cn } from "@/lib/utils"

type WeeklyDebriefPanelProps = {
  onViewTrade?: (tradeId: string) => void
  refreshKey?: number
}

function gradeColor(grade: string) {
  if (grade === "A" || grade === "B") return "text-profit"
  if (grade === "C") return "text-warning-foreground"
  return "text-loss"
}

function CommentaryList({
  title,
  items,
  tone = "neutral",
}: {
  title: string
  items: string[]
  tone?: "neutral" | "positive" | "warning" | "danger"
}) {
  if (items.length === 0) return null

  const toneClass =
    tone === "positive"
      ? "border-profit/15 bg-profit/[0.04]"
      : tone === "warning"
        ? "border-warning/15 bg-warning/[0.04]"
        : tone === "danger"
          ? "border-loss/15 bg-loss/[0.04]"
          : "border-white/[0.06] bg-white/[0.02]"

  return (
    <DashboardInsetPanel className={cn("space-y-2 px-3 py-3", toneClass)}>
      <p className="section-label text-muted-foreground/75">{title}</p>
      {items.map((item) => (
        <p key={item} className="text-[11px] leading-relaxed text-foreground/85">
          {item}
        </p>
      ))}
    </DashboardInsetPanel>
  )
}

function TrendChart({
  title,
  data,
  color,
}: {
  title: string
  data: Array<{ label: string; value: number }>
  color: string
}) {
  return (
    <DashboardInsetPanel className="glass h-[180px] px-2 py-2">
      <p className="section-label mb-2 px-1 text-muted-foreground/70">{title}</p>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data}>
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey="label" {...CHART_AXIS} tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
          <YAxis {...CHART_AXIS} width={28} domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </DashboardInsetPanel>
  )
}

export function WeeklyDebriefPanel({ onViewTrade, refreshKey = 0 }: WeeklyDebriefPanelProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [debrief, setDebrief] = useState<WeeklyDebriefResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchWeeklyDebrief(weekOffset)
        if (!cancelled) setDebrief(data)
      } catch (loadError) {
        if (!cancelled) {
          setDebrief(null)
          setError(loadError instanceof Error ? loadError.message : "Could not load weekly debrief")
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [weekOffset, refreshKey])

  async function handleCopyReport() {
    if (!debrief) return
    try {
      await copyWeeklyDebriefReport(debrief)
      setExportMessage("Report copied to clipboard.")
    } catch {
      setExportMessage("Could not copy report.")
    }
  }

  function handlePrintReport() {
    if (!debrief) return
    try {
      printWeeklyDebriefReport(debrief)
      setExportMessage("Print dialog opened — save as PDF from your browser.")
    } catch {
      setExportMessage("Could not open print export.")
    }
  }

  if (isLoading) {
    return (
      <DashboardCard className="glass-card floating-glow" glow>
        <DashboardCardBody className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-cyan-glow" />
        </DashboardCardBody>
      </DashboardCard>
    )
  }

  if (error || !debrief) {
    return (
      <DashboardInsetPanel className="border-loss/20 bg-loss/[0.05] px-4 py-4">
        <p className="text-[13px] text-loss/90">{error || "Weekly debrief unavailable"}</p>
      </DashboardInsetPanel>
    )
  }

  const { summary, commentary, grades, recommendations, visualizations, journalLinks } = debrief

  return (
    <DashboardCard className="glass-card floating-glow" glow interactive>
      <DashboardCardHeader
        title="Weekly AI Debrief"
        icon={Brain}
        badge={
          <Badge variant="outline" className="h-6 text-[10px]">
            {debrief.weekLabel}
          </Badge>
        }
      />
      <DashboardCardBody className="space-y-4 pt-2">
        <p className="text-[11px] leading-relaxed text-muted-foreground/70">
          Trade execution and coach-backed summary for this week. For behavioral discipline scores, use
          Analytics → Weekly review.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={weekOffset === 0 ? "default" : "outline"}
              className={cn("h-8", weekOffset === 0 && "nav-link--active")}
              onClick={() => setWeekOffset(0)}
            >
              This Week
            </Button>
            <Button
              type="button"
              size="sm"
              variant={weekOffset === -1 ? "default" : "outline"}
              className="h-8"
              onClick={() => setWeekOffset(-1)}
            >
              Last Week
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => void handleCopyReport()}>
              <Copy className="mr-1.5 size-3.5" />
              Copy Report
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={handlePrintReport}>
              <FileText className="mr-1.5 size-3.5" />
              Export PDF
            </Button>
          </div>
        </div>

        {exportMessage && (
          <p className="text-[11px] text-muted-foreground/75">{exportMessage}</p>
        )}

        {!debrief.hasData ? (
          <DashboardInsetPanel className="px-4 py-8 text-center">
            <CalendarRange className="mx-auto mb-2 size-5 text-muted-foreground/50" />
            <p className="text-[13px] font-medium text-foreground/85">No trades logged this week</p>
            <p className="mt-1 text-[11px] text-muted-foreground/70">
              Your weekly AI performance review will appear once trades are recorded.
            </p>
          </DashboardInsetPanel>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-5">
              <DashboardInsetPanel className="glass px-3 py-2.5">
                <p className="section-label text-muted-foreground/65">Total P&L</p>
                <p className={cn("mt-1 text-lg font-bold tabular-nums", getPnLTextClass(summary.totalPnL, summary.totalPnL >= 0 ? "WIN" : "LOSS"))}>
                  {formatPnL(summary.totalPnL, summary.totalPnL >= 0 ? "WIN" : "LOSS")}
                </p>
              </DashboardInsetPanel>
              <DashboardInsetPanel className="glass px-3 py-2.5">
                <p className="section-label text-muted-foreground/65">Win rate</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-cyan-glow">{summary.winRate}%</p>
              </DashboardInsetPanel>
              <DashboardInsetPanel className="glass px-3 py-2.5">
                <p className="section-label text-muted-foreground/65">Best setup</p>
                <p className="mt-1 truncate text-sm font-semibold text-profit">{summary.bestSetup || "—"}</p>
              </DashboardInsetPanel>
              <DashboardInsetPanel className="glass px-3 py-2.5">
                <p className="section-label text-muted-foreground/65">Worst setup</p>
                <p className="mt-1 truncate text-sm font-semibold text-loss">{summary.worstSetup || "—"}</p>
              </DashboardInsetPanel>
              <DashboardInsetPanel className="glass px-3 py-2.5">
                <p className="section-label text-muted-foreground/65">Discipline trend</p>
                <p className="mt-1 flex items-center gap-1 text-sm font-semibold capitalize">
                  {summary.disciplineTrend === "up" ? (
                    <TrendingUp className="size-4 text-profit" />
                  ) : summary.disciplineTrend === "down" ? (
                    <TrendingDown className="size-4 text-loss" />
                  ) : null}
                  {summary.disciplineTrend}
                </p>
              </DashboardInsetPanel>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              <DashboardInsetPanel className="glass px-3 py-2.5 text-center">
                <p className="text-[9px] text-muted-foreground/65">Best Session</p>
                <p className="mt-1 text-[12px] font-semibold text-foreground/90">{summary.bestSession || "—"}</p>
              </DashboardInsetPanel>
              <DashboardInsetPanel className="glass px-3 py-2.5 text-center">
                <p className="text-[9px] text-muted-foreground/65">Worst Session</p>
                <p className="mt-1 text-[12px] font-semibold text-foreground/90">{summary.worstSession || "—"}</p>
              </DashboardInsetPanel>
              <DashboardInsetPanel className="glass px-3 py-2.5 text-center">
                <p className="text-[9px] text-muted-foreground/65">Worst Emotion</p>
                <p className="mt-1 text-[12px] font-semibold text-warning-foreground">{summary.worstEmotionalState || "—"}</p>
              </DashboardInsetPanel>
              <DashboardInsetPanel className="glass px-3 py-2.5 text-center">
                <p className="text-[9px] text-muted-foreground/65">Avg Quality</p>
                <p className="mt-1 text-[12px] font-semibold text-cyan-glow">{summary.averageQualityScore ?? "—"}</p>
              </DashboardInsetPanel>
              <DashboardInsetPanel className="glass px-3 py-2.5 text-center md:col-span-2 xl:col-span-2">
                <p className="text-[9px] text-muted-foreground/65">Most Repeated Mistake</p>
                <p className="mt-1 truncate text-[12px] font-semibold text-loss">{summary.mostRepeatedMistake || "—"}</p>
              </DashboardInsetPanel>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {(
                [
                  ["Discipline", grades.discipline, grades.disciplineScore],
                  ["Execution", grades.execution, grades.executionScore],
                  ["Psychology", grades.psychology, grades.psychologyScore],
                  ["Risk Mgmt", grades.riskManagement, grades.riskManagementScore],
                  ["Overall", grades.overall, grades.overallScore],
                ] as const
              ).map(([label, grade, score]) => (
                <DashboardInsetPanel key={label} className="glass px-3 py-2.5 text-center">
                  <p className="section-label text-muted-foreground/65">{label}</p>
                  <p className={cn("mt-1 text-xl font-bold", gradeColor(grade))}>{grade}</p>
                  <Progress value={score} className="mt-2 h-1 bg-white/[0.06]" />
                  <p className="mt-1 text-[10px] tabular-nums text-muted-foreground/70">{score}/100</p>
                </DashboardInsetPanel>
              ))}
            </div>

            <DashboardInsetPanel className="space-y-3 border-cyan-glow/15 bg-cyan-glow/[0.03] px-3 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-cyan-glow" />
                <p className="text-[11px] font-semibold">AI weekly commentary</p>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <CommentaryList title="What Improved" items={commentary.improved} tone="positive" />
                <CommentaryList title="What Declined" items={commentary.declined} tone="warning" />
                <CommentaryList title="Emotional Observations" items={commentary.emotionalObservations} />
                <CommentaryList title="Execution Problems" items={commentary.executionProblems} tone="danger" />
                <CommentaryList title="Strongest Habits" items={commentary.strongestHabits} tone="positive" />
                <CommentaryList title="Dangerous Patterns" items={commentary.dangerousPatterns} tone="danger" />
              </div>
            </DashboardInsetPanel>

            <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
              <TrendChart title="Discipline Graph" data={visualizations.disciplineGraph} color="oklch(0.72 0.14 195)" />
              <TrendChart
                title="Emotional Stability"
                data={visualizations.emotionalStabilityGraph}
                color="oklch(0.7 0.18 155)"
              />
              <TrendChart
                title="Quality Score Trend"
                data={visualizations.qualityScoreTrend}
                color="oklch(0.75 0.16 300)"
              />
              <DashboardInsetPanel className="glass h-[180px] px-2 py-2 lg:col-span-1 xl:col-span-1">
                <p className="section-label mb-2 px-1 text-muted-foreground/70">Mistake frequency</p>
                <ResponsiveContainer width="100%" height="85%">
                  <BarChart data={visualizations.mistakeFrequency}>
                    <CartesianGrid {...CHART_GRID} />
                    <XAxis dataKey="label" {...CHART_AXIS} tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9 }} />
                    <YAxis {...CHART_AXIS} width={24} tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="count" fill="oklch(0.55 0.2 25)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </DashboardInsetPanel>
              <DashboardInsetPanel className="glass px-3 py-3 lg:col-span-2 xl:col-span-2">
                <p className="section-label mb-2 text-muted-foreground/70">Streak timeline</p>
                <div className="flex flex-wrap gap-2">
                  {visualizations.streakTimeline.map((point) => (
                    <button
                      key={`${point.tradeId}-${point.date}`}
                      type="button"
                      onClick={() => onViewTrade?.(point.tradeId)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.04]",
                        point.result === "WIN"
                          ? "border-profit/25 bg-profit/[0.06]"
                          : point.result === "LOSS"
                            ? "border-loss/25 bg-loss/[0.06]"
                            : "border-white/[0.08] bg-white/[0.02]",
                      )}
                    >
                      <p className="text-[10px] font-semibold text-foreground/90">{point.label}</p>
                      <p className="text-[9px] capitalize text-muted-foreground/70">{point.result}</p>
                    </button>
                  ))}
                </div>
              </DashboardInsetPanel>
            </div>

            <DashboardInsetPanel className="space-y-2 border-purple-400/15 bg-purple-400/[0.03] px-3 py-3">
              <p className="section-label text-foreground/85">AI recommendations</p>
              {recommendations.map((item) => (
                <p key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-foreground/85">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-cyan-glow" />
                  {item}
                </p>
              ))}
            </DashboardInsetPanel>

            <div className="grid gap-2 md:grid-cols-2">
              {journalLinks.bestTrade && (
                <DashboardInsetPanel className="border-profit/20 bg-profit/[0.04] px-3 py-3">
                  <p className="section-label text-profit/80">
                    {getBestTradeHighlightLabel(journalLinks.bestTrade.result, journalLinks.bestTrade.pnl)}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{journalLinks.bestTrade.pair}</p>
                  <p className={cn("text-[12px] tabular-nums", getPnLTextClass(journalLinks.bestTrade.pnl, journalLinks.bestTrade.result))}>
                    {formatPnL(journalLinks.bestTrade.pnl, journalLinks.bestTrade.result)} · {journalLinks.bestTrade.result}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 h-8 border-profit/20 text-profit"
                    onClick={() => onViewTrade?.(journalLinks.bestTrade!.id)}
                  >
                    Open Replay & Details
                  </Button>
                </DashboardInsetPanel>
              )}
              {journalLinks.worstTrade && (
                <DashboardInsetPanel className="border-loss/20 bg-loss/[0.04] px-3 py-3">
                  <p className="section-label text-loss/80">Worst trade</p>
                  <p className="mt-1 text-sm font-semibold">{journalLinks.worstTrade.pair}</p>
                  <p className={cn("text-[12px] tabular-nums", getPnLTextClass(journalLinks.worstTrade.pnl, journalLinks.worstTrade.result))}>
                    {formatPnL(journalLinks.worstTrade.pnl, journalLinks.worstTrade.result)} · {journalLinks.worstTrade.result}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 h-8 border-loss/20 text-loss"
                    onClick={() => onViewTrade?.(journalLinks.worstTrade!.id)}
                  >
                    Open Replay & Details
                  </Button>
                </DashboardInsetPanel>
              )}
            </div>

            {(journalLinks.replayTradeIds.length > 0 || journalLinks.screenshotTradeIds.length > 0) && (
              <DashboardInsetPanel className="glass px-3 py-3">
                <p className="section-label mb-2 flex items-center gap-1.5 text-muted-foreground/75">
                  <AlertTriangle className="size-3.5" />
                  Journal links
                </p>
                <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground/75">
                  <span>{journalLinks.replayTradeIds.length} replay-ready trade(s)</span>
                  <span>·</span>
                  <span>{journalLinks.screenshotTradeIds.length} screenshot(s) archived</span>
                </div>
              </DashboardInsetPanel>
            )}

            <details className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
              <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground/80">
                Preview shareable report text
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[10px] text-muted-foreground/75">
                {formatWeeklyDebriefReport(debrief)}
              </pre>
            </details>
          </>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}
