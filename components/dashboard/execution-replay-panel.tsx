"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowLeftRight,
  Brain,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Flag,
  Heart,
  Loader2,
  Pause,
  Play,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChartAnnotatedImage } from "@/components/chart-annotations/chart-annotated-image"
import { ChartOverlayToggle } from "@/components/chart-annotations/chart-overlay-toggle"
import type { ChartOverlayMode } from "@/lib/chart-annotations/types"
import { fetchExecutionReplay } from "@/lib/replay/api-client"
import { REPLAY_PHASE_ORDER } from "@/lib/replay/execution-replay-engine"
import type {
  ExecutionReplayCandleState,
  ExecutionReplayEvent,
  ExecutionReplayResult,
  ExecutionReplayTimelineMarker,
  ExecutionReplayTimelineMarkerType,
  ExecutionReplayTone,
} from "@/lib/replay/types"
import { useCountUp } from "@/hooks/use-count-up"
import { cn } from "@/lib/utils"

type ExecutionReplayPanelProps = {
  tradeId: string
  refreshKey?: number
}

const REPLAY_SPEEDS = [
  { id: 1, label: "1x", ms: 2800 },
  { id: 2, label: "2x", ms: 1400 },
  { id: 5, label: "5x", ms: 560 },
] as const

type ReplaySpeed = (typeof REPLAY_SPEEDS)[number]["id"]

function toneBorder(tone: ExecutionReplayTone) {
  if (tone === "success") return "border-profit/35 shadow-[0_0_24px_rgb(from var(--color-profit) r g b / 0.14)]"
  if (tone === "danger") return "border-loss/35 shadow-[0_0_24px_rgb(from var(--color-loss) r g b / 0.14)]"
  if (tone === "warning") return "border-warning/35 shadow-[0_0_24px_rgba(245,158,11,0.12)]"
  return "border-cyan-glow/30 shadow-[0_0_24px_rgb(from var(--color-accent) r g b / 0.1)]"
}

function scoreColor(score: number) {
  if (score >= 75) return "text-profit"
  if (score >= 55) return "text-warning-foreground"
  return "text-loss"
}

function gradeRingColor(grade: string) {
  if (grade === "A" || grade === "B") return "from-profit/30 via-cyan-glow/20 to-profit/10"
  if (grade === "C") return "from-warning/25 via-cyan-glow/15 to-warning/10"
  return "from-loss/25 via-warning/10 to-loss/10"
}

function markerIcon(type: ExecutionReplayTimelineMarkerType) {
  if (type === "emotion") return Heart
  if (type === "rule_violation") return ShieldAlert
  if (type === "rr_collapse") return TrendingDown
  if (type === "entry") return Crosshair
  if (type === "exit") return Flag
  return Sparkles
}

function markerColor(severity: ExecutionReplayTimelineMarker["severity"]) {
  if (severity === "critical") return "text-loss border-loss/45 bg-loss/12 replay-severity-glow-critical replay-marker-critical"
  if (severity === "warning") return "text-warning-foreground border-warning/40 bg-warning/10 replay-severity-glow-warning"
  return "text-cyan-glow border-cyan-glow/35 bg-cyan-glow/10 replay-severity-glow-info"
}

function driftGlow(severity: "warning" | "critical") {
  return severity === "critical" ? "replay-severity-glow-critical" : "replay-severity-glow-warning"
}

function AnimatedScore({
  value,
  className,
  ready = true,
}: {
  value: number
  className?: string
  ready?: boolean
}) {
  const animated = useCountUp(value, 700, ready)
  return <span className={cn("tabular-nums", className)}>{Math.round(animated)}</span>
}

function candleColors(candle: ExecutionReplayCandleState, active: boolean, passed: boolean) {
  const base =
    candle.sentiment === "bullish"
      ? "bg-profit"
      : candle.sentiment === "bearish" || candle.sentiment === "danger"
        ? "bg-loss"
        : candle.sentiment === "warning"
          ? "bg-amber-400"
          : "bg-white/45"

  return cn(
    base,
    active && "ring-2 ring-cyan-glow/70 ring-offset-1 ring-offset-surface-page scale-110 z-10",
    passed && !active && "opacity-55",
    !passed && !active && "opacity-35",
  )
}

function resolveEventForStep(replay: ExecutionReplayResult, globalStep: number): ExecutionReplayEvent {
  const candle = replay.candles[globalStep]
  if (!candle) return replay.events[0]
  return replay.events.find((event) => event.id === candle.phase) ?? replay.events[0]
}

function layoutTimelineMarkers(
  markers: ExecutionReplayTimelineMarker[],
  maxStep: number,
): Array<{ marker: ExecutionReplayTimelineMarker; left: number; offsetY: number }> {
  const grouped = new Map<number, ExecutionReplayTimelineMarker[]>()
  for (const marker of markers) {
    const bucket = grouped.get(marker.globalStep) ?? []
    bucket.push(marker)
    grouped.set(marker.globalStep, bucket)
  }

  return markers.map((marker) => {
    const group = grouped.get(marker.globalStep) ?? [marker]
    const index = group.findIndex((item) => item.id === marker.id)
    const offsetY = index * -12
    const left = maxStep > 0 ? (marker.globalStep / maxStep) * 100 : 0
    return { marker, left, offsetY }
  })
}

function ReplayCandle({
  candle,
  active,
  passed,
  onSelect,
}: {
  candle: ExecutionReplayCandleState
  active: boolean
  passed: boolean
  onSelect: () => void
}) {
  const bodyHeight = `${candle.bodyPercent * 0.38}px`
  const wickHeight = `${Math.min(candle.bodyPercent * 0.55, 36)}px`

  return (
    <button
      type="button"
      onClick={onSelect}
      data-step={candle.globalStep}
      className="group flex flex-col items-center gap-1 px-0.5 transition-all duration-300"
      aria-label={candle.label}
      title={candle.label}
    >
      <div
        className={cn(
          "relative flex flex-col items-center justify-end transition-all duration-500 ease-out",
          active && "replay-candle-active",
        )}
        style={{ height: wickHeight }}
      >
        <span className="mb-0.5 h-1 w-px bg-white/25" />
        <span
          className={cn(
            "replay-candle-body w-2.5 rounded-[2px]",
            candleColors(candle, active, passed),
            active && "replay-candle-body-active",
          )}
          style={{ height: bodyHeight, minHeight: "8px" }}
        />
      </div>
      <span
        className={cn(
          "max-w-[52px] truncate text-[7px] font-medium text-text-muted transition-colors",
          active ? "text-cyan-glow/90" : "text-muted-foreground/40 group-hover:text-muted-foreground/65",
        )}
      >
        {candle.phaseStep + 1}
      </span>
    </button>
  )
}

function SessionRecapScore({
  replay,
  scoresReady,
}: {
  replay: ExecutionReplayResult
  scoresReady: boolean
}) {
  const { sessionRecap } = replay

  return (
    <div className="replay-fade-in relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-black/50 via-surface-card to-black/40 p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgb(from var(--color-accent) r g b / 0.06),transparent_45%)]" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "relative flex size-20 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40",
              "shadow-[inset_0_0_30px_rgba(0,0,0,0.6)]",
            )}
          >
            <div
              className={cn(
                "absolute inset-0 rounded-full bg-gradient-to-br opacity-80",
                gradeRingColor(sessionRecap.grade),
              )}
            />
            <div className="relative text-center">
              <p className={cn("text-2xl font-bold", scoreColor(sessionRecap.overallScore))}>
                <AnimatedScore value={sessionRecap.overallScore} ready={scoresReady} />
              </p>
              <p className="text-[10px] font-medium text-text-muted">
                Grade {sessionRecap.grade}
              </p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium text-cyan-glow/75">
              Session recap
            </p>
            <p className="mt-1 max-w-sm text-[13px] font-medium leading-snug text-foreground/92">
              {sessionRecap.headline}
            </p>
            <Badge variant="outline" className="mt-2 h-5 border-white/10 text-[9px] capitalize">
              {sessionRecap.verdict.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {sessionRecap.pillars.map((pillar) => (
            <div
              key={pillar.label}
              className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2"
            >
              <p className="text-[9px] text-muted-foreground/60">{pillar.label}</p>
              <p className={cn("text-sm font-semibold", scoreColor(pillar.score))}>
                <AnimatedScore value={pillar.score} ready={scoresReady} />
              </p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="replay-score-bar h-full rounded-full bg-cyan-glow/70"
                  style={{ width: scoresReady ? `${pillar.score}%` : "0%" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CommentaryBubble({ event, stepKey }: { event: ExecutionReplayEvent; stepKey: string }) {
  return (
    <div key={stepKey} className="replay-bubble-in replay-coach-float relative">
      <div
        className={cn(
          "rounded-lg border border-white/[0.08] border-l-2 bg-surface-modal/95 px-4 py-3 shadow-[0_10px_36px_rgba(0,0,0,0.45)] backdrop-blur-sm",
          event.tone === "danger"
            ? "border-l-loss/70"
            : event.tone === "warning"
              ? "border-l-warning/60"
              : event.tone === "success"
                ? "border-l-profit/60"
                : "border-l-cyan-glow/55",
        )}
      >
        <div className="mb-2 flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
            <Brain className="size-3 text-cyan-glow/85" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-medium text-text-muted">
              Coach commentary
            </p>
            <p className="truncate text-[10px] text-muted-foreground/60">{event.subtitle}</p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "h-5 shrink-0 text-[9px] capitalize",
              event.tone === "danger" && "border-loss/30 text-loss",
              event.tone === "warning" && "border-warning/30 text-warning-foreground",
              event.tone === "success" && "border-profit/30 text-profit",
            )}
          >
            {event.tone}
          </Badge>
        </div>
        <p className="text-[12px] leading-relaxed text-foreground/88">{event.aiCommentary}</p>
      </div>
    </div>
  )
}

function TimelineHoverPreview({
  replay,
  step,
  maxStep,
}: {
  replay: ExecutionReplayResult
  step: number
  maxStep: number
}) {
  const candle = replay.candles[step]
  const event = resolveEventForStep(replay, step)
  const left = maxStep > 0 ? (step / maxStep) * 100 : 0

  return (
    <div
      className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 rounded-md border border-white/10 bg-surface-modal/95 px-2.5 py-1.5 shadow-lg backdrop-blur-sm"
      style={{ left: `${left}%` }}
    >
      <p className="whitespace-nowrap text-[9px] font-medium text-cyan-glow/80">
        {event.title}
      </p>
      <p className="whitespace-nowrap text-[10px] text-foreground/85">{candle?.label ?? event.subtitle}</p>
    </div>
  )
}

function SessionFinaleCard({ replay }: { replay: ExecutionReplayResult }) {
  const { sessionRecap, analytics, drifts } = replay
  const criticalCount = drifts.filter((drift) => drift.severity === "critical").length

  return (
    <div className="replay-finale-in relative overflow-hidden rounded-xl border border-white/[0.1] bg-gradient-to-b from-surface-card via-surface-card to-surface-page p-4 sm:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-glow/40 to-transparent" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-medium text-text-muted">
            Session complete
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-foreground/95">
            Execution review finished
          </p>
          <p className="mt-2 max-w-md text-[12px] leading-relaxed text-muted-foreground/75">
            {analytics.summary}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-center">
            <p className="text-[9px] font-medium text-text-muted">Process score</p>
            <p className={cn("text-xl font-bold", scoreColor(sessionRecap.overallScore))}>
              {sessionRecap.overallScore}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-center">
            <p className="text-[9px] font-medium text-text-muted">Grade</p>
            <p className="text-xl font-bold text-foreground/90">{sessionRecap.grade}</p>
          </div>
          {criticalCount > 0 && (
            <div
              className={cn(
                "rounded-lg border border-loss/30 bg-loss/[0.06] px-3 py-2 text-center",
                driftGlow("critical"),
              )}
            >
              <p className="text-[9px] font-medium text-loss/80">Critical drifts</p>
              <p className="text-xl font-bold text-loss">{criticalCount}</p>
            </div>
          )}
        </div>
      </div>
      <p className="relative mt-4 border-t border-white/[0.06] pt-3 text-[11px] text-foreground/80">
        {sessionRecap.headline}
      </p>
    </div>
  )
}

function EntryComparisonPanel({ replay }: { replay: ExecutionReplayResult }) {
  const entry = replay.entryComparison

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/25 p-3">
      <div className="mb-3 flex items-center gap-2">
        <ArrowLeftRight className="size-3.5 text-cyan-glow" />
        <p className="text-[10px] font-medium text-foreground/85">
          Entry vs planned
        </p>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground/75">{entry.summary}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          {
            label: "Entry",
            planned: entry.plannedEntry,
            actual: entry.actualEntry,
            aligned: entry.entryAligned,
          },
          {
            label: "Stop Loss",
            planned: entry.plannedStopLoss,
            actual: entry.actualStopLoss,
            aligned: entry.stopAligned,
          },
          {
            label: "Take Profit",
            planned: entry.plannedTakeProfit,
            actual: entry.actualTakeProfit,
            aligned: entry.targetAligned,
          },
        ].map((row) => (
          <div
            key={row.label}
            className={cn(
              "rounded-lg border px-2.5 py-2 transition-colors",
              row.aligned
                ? "border-profit/20 bg-profit/[0.04]"
                : "border-warning/25 bg-warning/[0.05]",
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-[9px] font-medium text-muted-foreground/70">{row.label}</p>
              <Badge
                variant="outline"
                className={cn(
                  "h-4 px-1.5 text-[8px]",
                  row.aligned ? "border-profit/25 text-profit" : "border-warning/30 text-warning-foreground",
                )}
              >
                {row.aligned ? "Aligned" : "Drift"}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              Plan: <span className="text-foreground/85">{row.planned}</span>
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              Actual: <span className="text-foreground/85">{row.actual}</span>
            </p>
          </div>
        ))}
      </div>
      {(entry.plannedRr || entry.actualRr) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {entry.plannedRr && (
            <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[9px] text-muted-foreground/75">
              Planned R:R <span className="font-medium text-foreground/85">{entry.plannedRr}</span>
            </span>
          )}
          {entry.actualRr && (
            <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[9px] text-muted-foreground/75">
              Actual R:R <span className="font-medium text-foreground/85">{entry.actualRr}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function WhatChangedSection({ replay }: { replay: ExecutionReplayResult }) {
  const changes = replay.changes.filter((item) => !item.aligned)

  if (changes.length === 0) {
    return (
      <div className="rounded-xl border border-profit/20 bg-profit/[0.04] px-3 py-3">
        <p className="text-[10px] font-medium text-profit/90">
          What changed?
        </p>
        <p className="mt-1 text-[11px] text-foreground/85">
          Nothing material — execution tracked the pre-trade plan.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/25 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Target className="size-3.5 text-warning-foreground" />
        <p className="text-[10px] font-medium text-foreground/85">
          What changed?
        </p>
      </div>
      <div className="space-y-2">
        {changes.map((change) => (
          <div
            key={change.field}
            className={cn(
              "rounded-lg border px-2.5 py-2",
              change.impact === "critical"
                ? "border-loss/25 bg-loss/[0.05] replay-severity-glow-critical"
                : "border-warning/20 bg-warning/[0.04] replay-severity-glow-warning",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-foreground/88">{change.field}</p>
              <Badge
                variant="outline"
                className={cn(
                  "h-4 text-[8px] capitalize",
                  change.impact === "critical"
                    ? "border-loss/30 text-loss"
                    : "border-warning/30 text-warning-foreground",
                )}
              >
                {change.impact}
              </Badge>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground/70">
              {change.planned} → {change.actual}
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/80">{change.note}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReplayStage({
  event,
  overlayMode,
  onOverlayModeChange,
}: {
  event: ExecutionReplayEvent
  overlayMode: ChartOverlayMode
  onOverlayModeChange: (mode: ChartOverlayMode) => void
}) {
  return (
    <div className={cn("replay-fade-in rounded-xl border bg-black/30 p-3", toneBorder(event.tone))}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-foreground/92">{event.title}</p>
          <p className="text-[10px] text-muted-foreground/65">{event.subtitle}</p>
        </div>
        <Badge variant="outline" className="h-5 shrink-0 text-[9px] capitalize">
          Phase {event.step + 1}
        </Badge>
      </div>

      {event.details.length > 0 && (
        <div className="mb-3 space-y-1">
          {event.details.slice(0, 4).map((detail) => (
            <p key={detail} className="text-[10px] leading-relaxed text-muted-foreground/80">
              {detail}
            </p>
          ))}
        </div>
      )}

      {event.warnings.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {event.warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-1.5 text-[10px] text-warning-muted/90">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      )}

      {Object.keys(event.metrics).length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {Object.entries(event.metrics).map(([key, value]) => (
            <span
              key={key}
              className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[9px] text-muted-foreground/75"
            >
              {key}: <span className="font-medium text-foreground/85">{value}</span>
            </span>
          ))}
        </div>
      )}

      {event.screenshots.length > 0 && (
        <div className="space-y-2">
          <ChartOverlayToggle mode={overlayMode} onChange={onOverlayModeChange} compact />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {event.screenshots.map((shot) => (
              <div
                key={`${shot.label}-${shot.url}`}
                className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/40"
              >
                <ChartAnnotatedImage
                  src={shot.url}
                  alt={shot.label}
                  annotations={shot.annotations}
                  mode={overlayMode}
                  className="h-24"
                  imageClassName="h-24 object-cover"
                />
                <p className="px-2 py-1 text-[9px] text-muted-foreground/70">{shot.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ExecutionReplayPanel({ tradeId, refreshKey = 0 }: ExecutionReplayPanelProps) {
  const [replay, setReplay] = useState<ExecutionReplayResult | null>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<ReplaySpeed>(1)
  const [hoverStep, setHoverStep] = useState<number | null>(null)
  const [flashToken, setFlashToken] = useState(0)
  const [scoresReady, setScoresReady] = useState(false)
  const [overlayMode, setOverlayMode] = useState<ChartOverlayMode>("replay")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const playTimerRef = useRef<number | null>(null)
  const candleStripRef = useRef<HTMLDivElement>(null)
  const flashedStepsRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchExecutionReplay(tradeId)
        if (cancelled) return
        setReplay(data)
        setActiveStep(0)
        setIsPlaying(false)
        setPlaybackSpeed(1)
        setHoverStep(null)
        flashedStepsRef.current = new Set()
        setScoresReady(false)
        requestAnimationFrame(() => setScoresReady(true))
      } catch (loadError) {
        if (!cancelled) {
          setReplay(null)
          setError(loadError instanceof Error ? loadError.message : "Could not load replay")
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [tradeId, refreshKey])

  const maxStep = useMemo(() => Math.max((replay?.candles.length ?? 1) - 1, 0), [replay])

  const activeCandle = useMemo(
    () => replay?.candles[activeStep] ?? null,
    [replay, activeStep],
  )

  const activeEvent = useMemo(() => {
    if (!replay) return null
    return resolveEventForStep(replay, activeStep)
  }, [replay, activeStep])

  const progressPercent = useMemo(() => {
    if (!replay || replay.candles.length <= 1) return 0
    return (activeStep / maxStep) * 100
  }, [activeStep, maxStep, replay])

  const phaseAnchors = useMemo(() => {
    if (!replay) return []
    return REPLAY_PHASE_ORDER.flatMap((phase) => {
      const candle = replay.candles.find((item) => item.phase === phase && item.phaseStep === 0)
      const event = replay.events.find((item) => item.id === phase)
      if (!candle || !event) return []
      return [{ phase, step: candle.globalStep, title: event.title }]
    })
  }, [replay])

  const playbackMs = useMemo(
    () => REPLAY_SPEEDS.find((speed) => speed.id === playbackSpeed)?.ms ?? 2800,
    [playbackSpeed],
  )

  const previewStep = hoverStep ?? activeStep

  const markerLayout = useMemo(
    () => (replay ? layoutTimelineMarkers(replay.markers, maxStep) : []),
    [maxStep, replay],
  )

  useEffect(() => {
    if (!replay || !activeEvent) return

    const markerCritical = replay.markers.some(
      (marker) => marker.globalStep === activeStep && marker.severity === "critical",
    )
    const phaseCritical =
      activeEvent.id === "rule_violations" &&
      replay.drifts.some((drift) => drift.severity === "critical")
    const toneCritical = activeEvent.tone === "danger" && activeEvent.warnings.length > 0

    if (
      (markerCritical || phaseCritical || toneCritical) &&
      !flashedStepsRef.current.has(activeStep)
    ) {
      flashedStepsRef.current.add(activeStep)
      setFlashToken((token) => token + 1)
    }
  }, [activeEvent, activeStep, replay])

  const stopPlayback = useCallback(() => {
    setIsPlaying(false)
    if (playTimerRef.current !== null) {
      window.clearInterval(playTimerRef.current)
      playTimerRef.current = null
    }
  }, [])

  const stepTo = useCallback(
    (next: number, pause = true) => {
      if (!replay) return
      if (pause) stopPlayback()
      setActiveStep(Math.max(0, Math.min(next, maxStep)))
    },
    [maxStep, replay, stopPlayback],
  )

  useEffect(() => {
    const activeEl = candleStripRef.current?.querySelector(`[data-step="${activeStep}"]`)
    activeEl?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
  }, [activeStep])

  useEffect(() => {
    if (!isPlaying || !replay) return

    playTimerRef.current = window.setInterval(() => {
      setActiveStep((current) => {
        if (current >= maxStep) {
          stopPlayback()
          return current
        }
        return current + 1
      })
    }, playbackMs)

    return () => {
      if (playTimerRef.current !== null) {
        window.clearInterval(playTimerRef.current)
        playTimerRef.current = null
      }
    }
  }, [isPlaying, maxStep, playbackMs, replay, stopPlayback])

  useEffect(() => () => stopPlayback(), [stopPlayback])

  if (isLoading) {
    return (
      <div className="replay-terminal flex min-h-[220px] items-center justify-center rounded-xl border border-cyan-glow/15 bg-surface-page">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-cyan-glow" />
          <p className="text-[10px] font-medium text-text-muted">
            Loading execution replay…
          </p>
        </div>
      </div>
    )
  }

  if (error || !replay || !activeEvent) {
    return (
      <div className="rounded-xl border border-loss/20 bg-loss/[0.05] px-3 py-3">
        <p className="text-[12px] text-loss/90">{error || "Replay unavailable"}</p>
      </div>
    )
  }

  return (
    <div className="replay-terminal relative overflow-hidden rounded-xl border border-white/[0.08] bg-surface-page">
      {flashToken > 0 && (
        <div key={flashToken} className="replay-critical-flash pointer-events-none absolute inset-0 z-20 rounded-xl" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgb(from var(--color-accent) r g b / 0.05),transparent_55%)]" />
      <div className="replay-scanline pointer-events-none absolute inset-0 opacity-[0.015]" />

      <div className="relative space-y-4 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-[12px] border border-cyan-glow/25 bg-cyan-glow/[0.08] shadow-[0_0_20px_rgb(from var(--color-accent) r g b / 0.12)]">
              <Play className="size-4 text-cyan-glow" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-foreground/90">
                Execution replay
              </p>
              <p className="text-[10px] text-muted-foreground/65">
                {replay.hasCoachSession ? "Coach-linked execution timeline" : "Journal-based replay"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {REPLAY_SPEEDS.map((speed) => (
              <Button
                key={speed.id}
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  "h-8 min-w-[40px] px-2 text-[10px] tabular-nums",
                  playbackSpeed === speed.id
                    ? "border-cyan-glow/35 bg-cyan-glow/10 text-cyan-glow"
                    : "border-white/10 bg-black/30 text-muted-foreground/70",
                )}
                onClick={() => setPlaybackSpeed(speed.id)}
              >
                {speed.label}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-white/10 bg-black/30 px-2"
              onClick={() => stepTo(activeStep - 1)}
              disabled={activeStep <= 0}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 min-w-[88px] border-cyan-glow/25 bg-cyan-glow/[0.06] text-cyan-glow hover:bg-cyan-glow/10"
              onClick={() => (isPlaying ? stopPlayback() : setIsPlaying(true))}
            >
              {isPlaying ? <Pause className="mr-1.5 size-3.5" /> : <Play className="mr-1.5 size-3.5" />}
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-white/10 bg-black/30 px-2"
              onClick={() => stepTo(activeStep + 1)}
              disabled={activeStep >= maxStep}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <SessionRecapScore replay={replay} scoresReady={scoresReady} />

        {replay.rrCollapse && (
          <div
            className={cn(
              "replay-fade-in flex items-start gap-2 rounded-xl border px-3 py-2.5",
              replay.rrCollapse.severity === "critical"
                ? "border-loss/30 bg-loss/[0.07] replay-severity-glow-critical"
                : "border-warning/30 bg-warning/[0.06] replay-severity-glow-warning",
            )}
          >
            <TrendingDown
              className={cn(
                "mt-0.5 size-4 shrink-0",
                replay.rrCollapse.severity === "critical" ? "text-loss" : "text-warning-foreground",
              )}
            />
            <div>
              <p className="text-[10px] font-medium text-foreground/85">
                R:R collapse warning
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/85">
                {replay.rrCollapse.message}
              </p>
              <p className="mt-1 text-[10px] tabular-nums text-muted-foreground/75">
                Planned {replay.rrCollapse.plannedRr.toFixed(1)}R → Actual{" "}
                {replay.rrCollapse.actualRr.toFixed(1)}R ({replay.rrCollapse.delta >= 0 ? "+" : ""}
                {replay.rrCollapse.delta.toFixed(1)}R)
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium text-text-muted">
              Candle progression
            </p>
            <p className="text-[10px] tabular-nums text-cyan-glow/80">
              {activeCandle?.label || activeEvent.title}
            </p>
          </div>
          <div className="chart-grid mb-3 overflow-x-auto rounded-lg border border-white/[0.04] bg-black/20 px-2 py-3" ref={candleStripRef}>
            <div className="flex min-w-max items-end justify-center gap-1">
              {replay.candles.map((candle) => (
                <ReplayCandle
                  key={candle.id}
                  candle={candle}
                  active={candle.globalStep === activeStep}
                  passed={candle.globalStep < activeStep}
                  onSelect={() => stepTo(candle.globalStep)}
                />
              ))}
            </div>
          </div>

          <div className="relative mb-2 min-h-[52px]">
            <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <div className="relative h-12 px-1">
              {markerLayout.map(({ marker, left, offsetY }) => {
                const Icon = markerIcon(marker.type)
                return (
                  <button
                    key={marker.id}
                    type="button"
                    onClick={() => stepTo(marker.globalStep)}
                    style={{ left: `${left}%`, top: `${8 + offsetY}px` }}
                    className={cn(
                      "absolute -translate-x-1/2 transition-transform hover:scale-110",
                      marker.globalStep === activeStep && "scale-110",
                    )}
                    title={marker.label}
                    aria-label={marker.label}
                  >
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full border",
                        markerColor(marker.severity),
                      )}
                    >
                      <Icon className="size-3" />
                    </span>
                    <span className="mt-0.5 block text-center text-[7px] font-medium text-text-muted">
                      {marker.shortLabel}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {phaseAnchors.length > 0 && (
            <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
              {phaseAnchors.map((anchor) => (
                <button
                  key={anchor.phase}
                  type="button"
                  onClick={() => stepTo(anchor.step)}
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-medium transition-colors",
                    activeEvent.id === anchor.phase
                      ? "border-cyan-glow/40 bg-cyan-glow/15 text-cyan-glow"
                      : "border-white/[0.08] bg-white/[0.03] text-muted-foreground/65 hover:border-white/[0.14]",
                  )}
                >
                  {anchor.title}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="font-medium text-foreground/85">{activeEvent.title}</span>
              <span className="tabular-nums text-muted-foreground/60">
                Step {activeStep + 1} / {replay.candles.length}
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="replay-score-bar absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-glow/60 to-cyan-glow/85"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="relative pt-1">
              {hoverStep !== null && replay && (
                <TimelineHoverPreview replay={replay} step={previewStep} maxStep={maxStep} />
              )}
              <input
                type="range"
                min={0}
                max={maxStep}
                value={activeStep}
                onChange={(event) => stepTo(Number(event.target.value))}
                onMouseMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  const ratio = (event.clientX - rect.left) / rect.width
                  setHoverStep(Math.max(0, Math.min(maxStep, Math.round(ratio * maxStep))))
                }}
                onMouseLeave={() => setHoverStep(null)}
                className="replay-slider h-1.5 w-full cursor-pointer"
                aria-label="Replay timeline"
              />
            </div>
          </div>
        </div>

        <CommentaryBubble event={activeEvent} stepKey={`${activeEvent.id}-${activeStep}`} />

        <ReplayStage
          key={activeEvent.id}
          event={activeEvent}
          overlayMode={overlayMode}
          onOverlayModeChange={setOverlayMode}
        />

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <EntryComparisonPanel replay={replay} />
          <WhatChangedSection replay={replay} />
        </div>

        {replay.drifts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {replay.drifts.map((drift) => (
              <Badge
                key={drift.id}
                variant="outline"
                className={cn(
                  "h-5 text-[9px]",
                  drift.severity === "critical"
                    ? "border-loss/25 text-loss replay-severity-glow-critical"
                    : "border-warning/25 text-warning-foreground replay-severity-glow-warning",
                )}
              >
                {drift.label}
              </Badge>
            ))}
          </div>
        )}

        {activeStep === maxStep && <SessionFinaleCard replay={replay} />}
      </div>
    </div>
  )
}
