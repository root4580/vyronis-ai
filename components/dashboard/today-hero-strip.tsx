"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, BarChart3, BookOpen, CheckCircle2, Circle, Sparkles } from "lucide-react"
import { fetchWeeklyPlan } from "@/lib/strategy-brain/api-client"
import { isWatchlistComplete } from "@/lib/strategy-brain/weekly-watchlist"
import { formatPnL } from "@/lib/trade-utils"
import { Button } from "@/components/ui/button"
import { EMOTION_OPTIONS } from "@/lib/trade-form-config"
import type { LeakEngineInput } from "@/lib/behavior"
import type { PlannedCoachSessionItem } from "@/lib/trade-coach/types"
import {
  buildDailyRitualView,
  hasCompletedCoachSessionToday,
  loadDailyRitualState,
  markRitualCheckIn,
  markRitualDebriefComplete,
  RITUAL_STEP_COUNT,
  type RitualStepId,
} from "@/lib/daily-ritual"
import { getTodayPrimaryAction } from "@/lib/dashboard-today"
import { cn } from "@/lib/utils"

type TodayHeroStripProps = {
  userId: string
  trades: LeakEngineInput["trades"]
  maxRiskPerTrade: number
  plannedSessions?: PlannedCoachSessionItem[]
  onOpenWarRoom?: () => void
  onOpenCoach: () => void
  onOpenLog: () => void
  onOpenPlan?: () => void
  onOpenJournal?: () => void
  onOpenWeeklyDebrief?: () => void
  onViewPerformance?: () => void
  onCoachEngaged?: () => void
  className?: string
}

export function TodayHeroStrip({
  userId,
  trades,
  maxRiskPerTrade,
  plannedSessions = [],
  onOpenWarRoom,
  onOpenCoach,
  onOpenLog,
  onOpenPlan,
  onOpenJournal,
  onOpenWeeklyDebrief,
  onViewPerformance,
  onCoachEngaged,
  className,
}: TodayHeroStripProps) {
  const [storedVersion, setStoredVersion] = useState(0)
  const [showCheckIn, setShowCheckIn] = useState(false)
  const [debriefOpen, setDebriefOpen] = useState(false)
  const [selectedEmotion, setSelectedEmotion] = useState("Calm")
  const [watchlistReady, setWatchlistReady] = useState(true)

  useEffect(() => {
    void fetchWeeklyPlan()
      .then((plan) => setWatchlistReady(isWatchlistComplete(plan)))
      .catch(() => setWatchlistReady(true))
  }, [])

  const storedState = useMemo(() => {
    void storedVersion
    return loadDailyRitualState(userId)
  }, [userId, storedVersion])

  const hasCompletedCoachToday = useMemo(
    () => hasCompletedCoachSessionToday(plannedSessions),
    [plannedSessions],
  )

  const view = useMemo(
    () =>
      buildDailyRitualView({
        userId,
        trades,
        maxRiskPerTrade,
        warRoomReady: watchlistReady,
        hasCompletedCoachToday,
        storedState,
      }),
    [userId, trades, maxRiskPerTrade, watchlistReady, hasCompletedCoachToday, storedState],
  )

  const action = useMemo(() => getTodayPrimaryAction(view), [view])
  const bumpStorage = useCallback(() => setStoredVersion((v) => v + 1), [])

  function handlePrimaryCta() {
    if (view.allComplete) {
      onViewPerformance?.()
      return
    }

    switch (action.stepId) {
      case "war-room":
        onOpenWarRoom?.()
        break
      case "check-in":
        setShowCheckIn(true)
        break
      case "coach":
        onCoachEngaged?.()
        onOpenCoach()
        break
      case "log":
        onOpenLog()
        break
      case "debrief":
        setShowCheckIn(false)
        setDebriefOpen(true)
        break
      default:
        setShowCheckIn(true)
    }
  }

  function handleCheckIn() {
    markRitualCheckIn(userId, selectedEmotion)
    bumpStorage()
    setShowCheckIn(false)
  }

  function handleStepClick(stepId: RitualStepId) {
    switch (stepId) {
      case "war-room":
        onOpenWarRoom?.()
        break
      case "check-in":
        setShowCheckIn(true)
        setDebriefOpen(false)
        break
      case "coach":
        onCoachEngaged?.()
        onOpenCoach()
        break
      case "log":
        onOpenLog()
        break
      case "debrief":
        setShowCheckIn(false)
        setDebriefOpen(true)
        break
      default:
        break
    }
  }

  const shortcutItems = [
    onOpenJournal
      ? { id: "journal", label: "Journal", icon: BookOpen, onClick: onOpenJournal }
      : null,
    onViewPerformance
      ? { id: "performance", label: "Performance", icon: BarChart3, onClick: onViewPerformance }
      : null,
  ].filter((item): item is { id: string; label: string; icon: typeof BookOpen; onClick: () => void } =>
    Boolean(item),
  )

  return (
    <section
      aria-label="Today"
      className={cn(
        "today-hero-strip relative overflow-hidden rounded-2xl border border-cyan-glow/20 bg-gradient-to-br from-cyan-glow/[0.08] via-white/[0.02] to-profit/[0.04] p-4 shadow-[0_0_40px_rgba(34,211,238,0.08)] sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-glow/85">
            Today
          </p>
          <h2 className="mt-1 text-[17px] font-semibold leading-snug tracking-tight text-foreground sm:text-[18px]">
            {action.title}
          </h2>
          <p className="mt-1 max-w-md text-[12px] leading-relaxed text-muted-foreground/80">
            {action.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-glow to-profit/80 transition-all"
              style={{ width: `${view.progressPercent}%` }}
            />
          </div>
          <span className="text-[10px] font-medium tabular-nums text-foreground/85">
            {view.completedCount}/{RITUAL_STEP_COUNT}
          </span>
        </div>
      </div>

      {onOpenPlan ? (
        <div className="mt-4 rounded-xl border border-cyan-glow/25 bg-cyan-glow/[0.05] p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13px] font-semibold text-foreground/92">
                Before you trade — score your setup
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/75">
                Use Plan mode to run Vyronis scoring before you click live.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onOpenPlan}
              className="h-10 shrink-0 border-cyan-glow/30 bg-cyan-glow/[0.08] text-cyan-glow hover:bg-cyan-glow/[0.12]"
            >
              Plan Setup
              <ArrowRight className="ml-1.5 size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        onClick={handlePrimaryCta}
        className="today-hero-cta mt-4 h-11 w-full bg-gradient-to-r from-cyan-glow to-profit text-[13px] font-semibold text-background shadow-[0_0_28px_rgba(34,211,238,0.2)] hover:from-cyan-glow/95 hover:to-profit/95 sm:h-12"
      >
        {action.ctaLabel}
        <ArrowRight className="ml-2 size-4" />
      </Button>

      <div className="mt-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/55">
          Daily workflow
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {view.steps.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => handleStepClick(step.id)}
              className={cn(
                "vyronis-surface flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-center transition-colors hover:border-cyan-glow/25 hover:bg-cyan-glow/[0.04]",
                step.status === "complete"
                  ? "border-cyan-glow/25 bg-cyan-glow/[0.06]"
                  : step.status === "current"
                    ? "border-cyan-glow/35 bg-cyan-glow/[0.1]"
                    : "border-white/[0.06]",
              )}
            >
              {step.status === "complete" ? (
                <CheckCircle2 className="size-4 text-cyan-glow" />
              ) : (
                <Circle
                  className={cn(
                    "size-4",
                    step.status === "current" ? "text-cyan-glow" : "text-muted-foreground/45",
                  )}
                />
              )}
              <span
                className={cn(
                  "text-[10px] font-semibold leading-tight",
                  step.status === "complete" || step.status === "current"
                    ? "text-foreground/90"
                    : "text-muted-foreground/70",
                )}
              >
                {step.shortLabel}
              </span>
            </button>
          ))}
        </div>

        {shortcutItems.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {shortcutItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground/80 transition-colors hover:border-cyan-glow/20 hover:text-cyan-glow/90"
              >
                <item.icon className="size-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {showCheckIn && action.stepId === "check-in" && !view.allComplete && (
        <div className="mt-3 space-y-3 rounded-xl border border-white/[0.08] bg-black/25 p-3">
          <p className="text-[11px] text-muted-foreground/80">How are you showing up today?</p>
          <div className="grid grid-cols-4 gap-1.5">
            {EMOTION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedEmotion(option.value)}
                className={cn(
                  "rounded-lg border px-1 py-1.5 text-center text-[10px] transition-colors",
                  selectedEmotion === option.value
                    ? "border-cyan-glow/40 bg-cyan-glow/[0.12] text-cyan-glow"
                    : "border-white/[0.06] text-muted-foreground/75",
                )}
              >
                <span className="block text-sm">{option.emoji}</span>
                {option.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            onClick={handleCheckIn}
            className="h-10 w-full bg-cyan-glow/90 text-background"
          >
            <Sparkles className="mr-2 size-4" />
            Save check-in
          </Button>
        </div>
      )}

      {(debriefOpen || view.steps.find((s) => s.id === "debrief")?.status === "current") &&
        !view.allComplete && (
          <div className="mt-3 space-y-3 rounded-xl border border-white/[0.08] bg-black/25 p-3">
            <div className="flex flex-wrap gap-3 text-[11px] tabular-nums text-muted-foreground/80">
              <span>{view.debrief.tradeCount} trades today</span>
              <span>
                {view.debrief.winCount}W / {view.debrief.lossCount}L
              </span>
              <span className={view.debrief.todayPnL >= 0 ? "text-profit" : "text-loss"}>
                {formatPnL(
                  Math.abs(view.debrief.todayPnL),
                  view.debrief.todayPnL >= 0 ? "WIN" : "LOSS",
                )}
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-foreground/90">
              {view.debrief.correctiveAction}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {onOpenWeeklyDebrief ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 flex-1 border-cyan-glow/25 bg-cyan-glow/[0.04] text-cyan-glow"
                  onClick={onOpenWeeklyDebrief}
                >
                  Weekly debrief
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-9 flex-1 border-white/[0.1] bg-white/[0.03]"
                disabled={view.debrief.tradeCount === 0}
                onClick={() => {
                  markRitualDebriefComplete(userId)
                  bumpStorage()
                  setDebriefOpen(false)
                }}
              >
                Close today&apos;s session
              </Button>
            </div>
          </div>
        )}
    </section>
  )
}
