"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Brain,
  Calendar,
  Clock,
  Image as ImageIcon,
  Maximize2,
  Pencil,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { TradeCoachFeedbackPanel } from "@/components/dashboard/trade-coach-feedback-panel"
import { TradeIntelligencePanel } from "@/components/dashboard/trade-intelligence-panel"
import { ExecutionReplayPanel } from "@/components/dashboard/execution-replay-panel"
import { TradeQualityTradeSection } from "@/components/dashboard/trade-quality-trade-section"
import { SetupScoreBadge } from "@/components/dashboard/setup-score-badge"
import { VyronisScoreResultPanel } from "@/components/dashboard/vyronis-score-result-panel"
import { VyronisGradeBadge } from "@/components/dashboard/vyronis-grade-badge"
import type { VyronisJournalEvaluationRecord } from "@/lib/strategy/vyronis-journal-bridge"
import {
  resolveStoredSetupScore,
  type SetupCoachingInsight,
  type SetupScoreBreakdown,
} from "@/lib/trade-coach/setup-score-engine"
import type { VyronisScoreBreakdown } from "@/types/strategy"
import {
  buildTradeDetailAnalysis,
  getEmotionDisplay,
  type TradeDetailInsight,
} from "@/lib/trade-detail-insights"
import { formatRiskReward, getTradeRiskReward } from "@/lib/trade-form-utils"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { LinkedPlanDisciplineSection } from "@/components/trade-planner/linked-plan-discipline-section"

export type TradeDetails = {
  id: string
  pair: string
  direction: string
  result: string
  pnl: number
  emotion: string
  emotion_after?: string | null
  setup: string
  strategy_name: string | null
  risk_percent: number | null
  rule_followed: boolean | null
  session: string | null
  trade_date: string | null
  created_at: string
  confirmation_signal: string | null
  mistake_tags?: string | null
  trade_notes?: string | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
  risk_reward?: number | null
  screenshot_url?: string | null
  setup_score?: number | null
  setup_classification?: string | null
  setup_score_breakdown?: SetupScoreBreakdown | VyronisScoreBreakdown | null
  setup_coaching_insights?: SetupCoachingInsight[] | null
  weekly_bias?: string | null
  daily_bias?: string | null
  h4_bias?: string | null
  aoi_type?: string | null
  confirmation_type?: string | null
  entry_quality?: string | null
  vyronis_evaluation?: VyronisJournalEvaluationRecord | null
  plan_id?: string | null
}

type TradeDetailsModalProps = {
  trade: TradeDetails | null
  maxRiskPerTrade?: number
  coachFeedbackRefreshKey?: number
  onClose: () => void
  onEdit?: (trade: TradeDetails) => void
  onScreenshotClick?: (trade: TradeDetails) => void
  isScreenshotOpen?: boolean
}

const ANIMATION_MS = 280

function useTradeDetailPresence(open: boolean) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }

    setVisible(false)
    const timer = window.setTimeout(() => setMounted(false), ANIMATION_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  return { mounted, visible }
}

function InsightRow({ insight }: { insight: TradeDetailInsight }) {
  const toneClass =
    insight.type === "positive"
      ? "border-profit/20 bg-profit/[0.06] text-profit/90"
      : insight.type === "warning"
        ? "border-loss/20 bg-loss/[0.06] text-loss/90"
        : "border-cyan-glow/15 bg-cyan-glow/[0.05] text-cyan-glow/90"

  return (
    <div className={cn("rounded-xl border px-3 py-2.5 text-[12px] leading-relaxed text-foreground/90", toneClass)}>
      {insight.message}
    </div>
  )
}

function MetricTile({
  label,
  value,
  valueClassName = "text-foreground",
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <DashboardInsetPanel className="glass min-w-0 text-center">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60">{label}</p>
      <p className={cn("mt-1 truncate text-base font-bold tabular-nums sm:text-lg", valueClassName)}>{value}</p>
    </DashboardInsetPanel>
  )
}

export function TradeDetailsModal({
  trade,
  maxRiskPerTrade = 1,
  coachFeedbackRefreshKey = 0,
  onClose,
  onEdit,
  onScreenshotClick,
  isScreenshotOpen = false,
}: TradeDetailsModalProps) {
  const open = !!trade
  const isMobile = useIsMobile()
  const { mounted, visible } = useTradeDetailPresence(open)

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!mounted) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isScreenshotOpen) handleClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [mounted, handleClose, isScreenshotOpen])

  const analysis = useMemo(
    () => (trade ? buildTradeDetailAnalysis(trade, maxRiskPerTrade) : null),
    [trade, maxRiskPerTrade],
  )
  const setupScore = useMemo(
    () => (trade ? resolveStoredSetupScore(trade) : null),
    [trade],
  )
  const vyronisEvaluation = trade?.vyronis_evaluation ?? null
  const riskReward = useMemo(() => (trade ? getTradeRiskReward(trade) : null), [trade])

  if (!mounted || !trade || !analysis || !setupScore) return null

  const resultTone =
    trade.result === "WIN" ? "profit" : trade.result === "LOSS" ? "loss" : "neutral"
  const emotionBefore = getEmotionDisplay(trade.emotion)
  const emotionAfter = getEmotionDisplay(trade.emotion_after)
  const tradeTimestamp = new Date(trade.trade_date || trade.created_at)
  const formattedDate = tradeTimestamp.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const formattedTime = tradeTimestamp.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div
      className={cn(
        "trade-detail-viewer fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-3 md:p-5",
        visible ? "trade-detail-open" : "trade-detail-closing",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={`${trade.pair} trade details`}
    >
      <button
        type="button"
        className="trade-detail-overlay absolute inset-0 cursor-default"
        onClick={handleClose}
        aria-label="Close trade details"
      />

      <div
        className={cn(
          "trade-detail-panel glass-card relative flex max-h-[100dvh] w-full flex-col overflow-hidden sm:h-[min(94dvh,920px)] sm:max-h-[94dvh] sm:max-w-6xl sm:rounded-2xl",
          resultTone === "profit" && "trade-detail-panel-win",
          resultTone === "loss" && "trade-detail-panel-loss",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-glow/[0.05] via-transparent to-amber-500/[0.04]" />
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-32 opacity-70",
            resultTone === "profit" && "bg-gradient-to-b from-profit/[0.08] to-transparent",
            resultTone === "loss" && "bg-gradient-to-b from-loss/[0.08] to-transparent",
            resultTone === "neutral" && "bg-gradient-to-b from-cyan-glow/[0.06] to-transparent",
          )}
        />

        <header className="relative shrink-0 border-b border-white/[0.06] px-4 py-4 md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{trade.pair}</h2>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-7 text-[11px]",
                    trade.direction === "BUY"
                      ? "border-profit/30 bg-profit/[0.08] text-profit"
                      : "border-loss/30 bg-loss/[0.08] text-loss",
                  )}
                >
                  {trade.direction === "BUY" ? (
                    <TrendingUp className="mr-1 size-3.5" />
                  ) : (
                    <TrendingDown className="mr-1 size-3.5" />
                  )}
                  {trade.direction}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-7 text-[11px]",
                    trade.result === "WIN"
                      ? "border-profit/30 bg-profit/[0.08] text-profit"
                      : trade.result === "LOSS"
                        ? "border-loss/30 bg-loss/[0.08] text-loss"
                        : "border-white/10 bg-white/[0.03] text-muted-foreground",
                  )}
                >
                  {trade.result}
                </Badge>
                {vyronisEvaluation ? (
                  <VyronisGradeBadge
                    grade={vyronisEvaluation.grade}
                    score={vyronisEvaluation.score}
                    size="md"
                  />
                ) : (
                  <SetupScoreBadge
                    classification={setupScore.classification}
                    score={setupScore.score}
                    size="md"
                    showScore
                  />
                )}
              </div>
              <p className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
                Trade discipline review
              </p>
              <Link
                href={`/journal/trade/${trade.id}`}
                className="mt-2 inline-flex text-[11px] font-medium text-cyan-glow hover:text-cyan-glow/80"
              >
                Read full analysis →
              </Link>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] p-2 transition-all hover:border-white/[0.14] hover:bg-white/[0.06]"
              aria-label="Close"
            >
              <X className="size-5 text-muted-foreground" />
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)] md:gap-5 md:p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MetricTile
                  label="P&L"
                  value={formatPnL(trade.pnl, trade.result)}
                  valueClassName={getPnLTextClass(trade.pnl, trade.result)}
                />
                <MetricTile
                  label="Risk/Reward"
                  value={formatRiskReward(riskReward)}
                  valueClassName="text-cyan-glow"
                />
                <MetricTile
                  label="Risk"
                  value={`${(trade.risk_percent ?? 1).toFixed(1)}%`}
                  valueClassName={(trade.risk_percent ?? 1) > 1 ? "text-loss" : "text-foreground/90"}
                />
                <MetricTile
                  label="Setup"
                  value={trade.setup || "—"}
                  valueClassName="text-[13px] sm:text-sm"
                />
              </div>

              {trade.plan_id ? <LinkedPlanDisciplineSection trade={trade} /> : null}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <DashboardInsetPanel className="glass">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">Session</p>
                  <p className="mt-1 text-sm font-medium text-cyan-glow/95">{trade.session || "—"}</p>
                </DashboardInsetPanel>
                <DashboardInsetPanel className="glass">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">Strategy</p>
                  <p className="mt-1 text-sm font-medium text-foreground/90">{trade.strategy_name || "—"}</p>
                </DashboardInsetPanel>
                <DashboardInsetPanel className="glass flex items-center gap-2">
                  <Calendar className="size-4 shrink-0 text-muted-foreground/60" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">Timestamp</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground/90">{formattedDate}</p>
                    <p className="text-[11px] text-muted-foreground/70">{formattedTime}</p>
                  </div>
                </DashboardInsetPanel>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <DashboardInsetPanel className="glass">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">Emotion Before</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-2xl">{emotionBefore.emoji}</span>
                    <p className="text-sm font-medium text-foreground/90">{emotionBefore.label}</p>
                  </div>
                </DashboardInsetPanel>
                <DashboardInsetPanel className="glass">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">Emotion After</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-2xl">{emotionAfter.emoji}</span>
                    <p className="text-sm font-medium text-foreground/90">{emotionAfter.label}</p>
                  </div>
                </DashboardInsetPanel>
              </div>

              {(trade.entry_price || trade.stop_loss || trade.take_profit) && (
                <DashboardInsetPanel className="glass">
                  <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">Execution Levels</p>
                  <div className="grid grid-cols-3 gap-2 text-[12px]">
                    <div>
                      <span className="text-muted-foreground/60">Entry</span>
                      <p className="font-semibold tabular-nums">{trade.entry_price ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground/60">Stop</span>
                      <p className="font-semibold tabular-nums text-loss">{trade.stop_loss ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground/60">Target</span>
                      <p className="font-semibold tabular-nums text-profit">{trade.take_profit ?? "—"}</p>
                    </div>
                  </div>
                </DashboardInsetPanel>
              )}

              {(trade.weekly_bias || trade.daily_bias || trade.h4_bias || trade.aoi_type) && (
                <DashboardInsetPanel className="glass">
                  <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">
                    Vyronis Core Model
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                    {trade.weekly_bias && (
                      <div>
                        <span className="text-muted-foreground/60">Weekly</span>
                        <p className="font-medium capitalize">{trade.weekly_bias}</p>
                      </div>
                    )}
                    {trade.daily_bias && (
                      <div>
                        <span className="text-muted-foreground/60">Daily</span>
                        <p className="font-medium capitalize">{trade.daily_bias}</p>
                      </div>
                    )}
                    {trade.h4_bias && (
                      <div>
                        <span className="text-muted-foreground/60">H4</span>
                        <p className="font-medium capitalize">{trade.h4_bias}</p>
                      </div>
                    )}
                    {trade.aoi_type && (
                      <div>
                        <span className="text-muted-foreground/60">AOI</span>
                        <p className="font-medium capitalize">{trade.aoi_type.replace(/_/g, " ")}</p>
                      </div>
                    )}
                    {trade.confirmation_type && (
                      <div>
                        <span className="text-muted-foreground/60">Confirmation</span>
                        <p className="font-medium capitalize">{trade.confirmation_type.replace(/_/g, " ")}</p>
                      </div>
                    )}
                    {trade.entry_quality && (
                      <div>
                        <span className="text-muted-foreground/60">Entry</span>
                        <p className="font-medium capitalize">{trade.entry_quality}</p>
                      </div>
                    )}
                  </div>
                </DashboardInsetPanel>
              )}

              {isMobile ? (
                <DashboardInsetPanel className="border-amber-500/20 bg-amber-500/[0.07] px-4 py-3">
                  <p className="text-[12px] font-medium text-foreground/90">
                    Open on desktop for full cinematic replay
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">
                    Mobile shows your grade, P&L, and AI observations. Use a larger screen for the full timeline replay.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MetricTile
                      label="P&L"
                      value={formatPnL(trade.pnl, trade.result)}
                      valueClassName={getPnLTextClass(trade.pnl, trade.result)}
                    />
                    <MetricTile
                      label="Grade"
                      value={vyronisEvaluation?.grade ?? setupScore.classification}
                    />
                  </div>
                  {analysis.insights.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {analysis.insights.slice(0, 2).map((insight) => (
                        <InsightRow key={insight.id} insight={insight} />
                      ))}
                    </div>
                  ) : null}
                </DashboardInsetPanel>
              ) : (
                <ExecutionReplayPanel tradeId={trade.id} refreshKey={coachFeedbackRefreshKey} />
              )}

              <DashboardInsetPanel className="glass overflow-hidden p-0">
                {trade.screenshot_url ? (
                  <button
                    type="button"
                    onClick={() => onScreenshotClick?.(trade)}
                    className="group relative block w-full text-left"
                    aria-label="Open screenshot zoom"
                  >
                    <img
                      src={trade.screenshot_url}
                      alt={`${trade.pair} chart screenshot`}
                      className="trade-detail-screenshot max-h-[280px] w-full object-cover sm:max-h-[360px] md:max-h-[420px]"
                    />
                    <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/70 via-black/10 to-transparent p-4 opacity-90 transition-opacity group-hover:opacity-100">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">Chart Preview</p>
                        <p className="text-sm font-medium text-white">Click to zoom</p>
                      </div>
                      <div className="flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/35 backdrop-blur-sm">
                        <Maximize2 className="size-4 text-cyan-glow" />
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="flex min-h-[180px] flex-col items-center justify-center px-4 py-8 text-center">
                    <div className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                      <ImageIcon className="size-5 text-muted-foreground/35" />
                    </div>
                    <p className="text-sm font-medium text-foreground/85">No screenshot attached</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">Edit this trade to upload a chart screenshot.</p>
                  </div>
                )}
              </DashboardInsetPanel>

              <DashboardInsetPanel className="glass">
                <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">Notes</p>
                <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">
                  {trade.trade_notes?.trim() || "No notes recorded for this trade."}
                </p>
              </DashboardInsetPanel>
            </div>

            <aside className="space-y-4">
              {vyronisEvaluation && (
                <VyronisScoreResultPanel evaluation={vyronisEvaluation} compact />
              )}

              <TradeIntelligencePanel
                tradeId={trade.id}
                refreshKey={coachFeedbackRefreshKey}
                onScreenshotClick={
                  trade.screenshot_url ? () => onScreenshotClick?.(trade) : undefined
                }
              />

              {analysis.insights.length > 0 && (
                <DashboardInsetPanel className="glass space-y-3 border-cyan-glow/15 bg-cyan-glow/[0.03]">
                  <div className="flex items-center gap-2">
                    <Brain className="size-4 text-cyan-glow" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Quick Insights</p>
                  </div>
                  <div className="space-y-2">
                    {analysis.insights.map((insight) => (
                      <InsightRow key={insight.id} insight={insight} />
                    ))}
                  </div>
                </DashboardInsetPanel>
              )}

              <TradeQualityTradeSection
                tradeId={trade.id}
                tradeResult={trade.result}
                refreshKey={coachFeedbackRefreshKey}
              />

              <TradeCoachFeedbackPanel tradeId={trade.id} refreshKey={coachFeedbackRefreshKey} />

              <DashboardInsetPanel className="glass flex items-center gap-2 text-[11px] text-muted-foreground/70">
                <Clock className="size-3.5 shrink-0" />
                <span>
                  Logged {formattedDate} at {formattedTime}
                </span>
              </DashboardInsetPanel>
            </aside>
          </div>
        </div>

        <footer className="relative shrink-0 border-t border-white/[0.06] bg-black/25 px-4 py-4 backdrop-blur-md md:px-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            {onEdit && (
              <Button
                type="button"
                onClick={() => onEdit(trade)}
                className="flex-1 bg-gradient-to-r from-cyan-glow to-cyan-glow/80 text-background"
              >
                <Pencil className="mr-2 size-4" />
                Edit Trade
              </Button>
            )}
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1 border-white/[0.08]">
              Close
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/55">Press ESC to close</p>
        </footer>
      </div>
    </div>
  )
}
