"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Brain, CheckCircle2, Circle, ClipboardList, Crosshair, NotebookPen, Sparkles } from "lucide-react"
import { fetchWeeklyPlan } from "@/lib/strategy-brain/api-client"
import { isWatchlistComplete } from "@/lib/strategy-brain/weekly-watchlist"
import { Button } from "@/components/ui/button"
import { EMOTION_OPTIONS } from "@/lib/trade-form-config"
import type { LeakEngineInput } from "@/lib/behavior"
import {
  buildDailyRitualView,
  hasCompletedCoachSessionToday,
  loadDailyRitualState,
  markRitualCheckIn,
  markRitualDebriefComplete,
  type RitualStepId,
} from "@/lib/daily-ritual"
import type { PlannedCoachSessionItem } from "@/lib/trade-coach/types"
import { formatPnL } from "@/lib/trade-utils"
import { cn } from "@/lib/utils"

type DailyRitualStripProps = {
  userId: string
  trades: LeakEngineInput["trades"]
  maxRiskPerTrade: number
  plannedSessions?: PlannedCoachSessionItem[]
  onOpenWarRoom?: () => void
  onOpenCoach: () => void
  onOpenLog: () => void
  onCoachEngaged?: () => void
  className?: string
}

const STEP_ICONS: Record<RitualStepId, typeof Circle> = {
  "war-room": Crosshair,
  "check-in": Sparkles,
  coach: Brain,
  log: ClipboardList,
  debrief: NotebookPen,
}

function StepIcon({ complete }: { complete: boolean }) {
  if (complete) {
    return <CheckCircle2 className="size-4 text-cyan-glow" />
  }
  return <Circle className="size-4 text-muted-foreground/40" />
}

export function DailyRitualStrip({
  userId,
  trades,
  maxRiskPerTrade,
  plannedSessions = [],
  onOpenWarRoom,
  onOpenCoach,
  onOpenLog,
  onCoachEngaged,
  className,
}: DailyRitualStripProps) {
  const [storedVersion, setStoredVersion] = useState(0)
  const [activePanel, setActivePanel] = useState<RitualStepId | null>(null)
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

  const bumpStorage = useCallback(() => setStoredVersion((v) => v + 1), [])

  const handleCheckIn = useCallback(() => {
    markRitualCheckIn(userId, selectedEmotion)
    bumpStorage()
    setActivePanel(null)
  }, [userId, selectedEmotion, bumpStorage])

  const handleCoach = useCallback(() => {
    onCoachEngaged?.()
    onOpenCoach()
    setActivePanel(null)
  }, [onOpenCoach, onCoachEngaged])

  const handleDebriefComplete = useCallback(() => {
    markRitualDebriefComplete(userId)
    bumpStorage()
    setActivePanel(null)
  }, [userId, bumpStorage])

  const handleStepClick = (stepId: RitualStepId) => {
    const step = view.steps.find((row) => row.id === stepId)
    if (!step) return

    if (stepId === "war-room") {
      onOpenWarRoom?.()
      return
    }
    if (stepId === "log") {
      onOpenLog()
      return
    }
    if (stepId === "coach") {
      handleCoach()
      return
    }
    setActivePanel((current) => (current === stepId ? null : stepId))
  }

  return (
    <section
      aria-label="Daily trading ritual"
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 shadow-[0_0_28px_rgba(0,0,0,0.1)] sm:p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/65">
            Daily ritual
          </p>
          <p className="text-[12px] font-medium text-foreground/90">
            {view.allComplete
              ? "Session closed with discipline"
              : "War Room → Check-in → Coach → Log → Debrief"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.06] sm:w-28">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-glow/80 to-profit/70 transition-all duration-300"
              style={{ width: `${view.progressPercent}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground/70">
            {view.completedCount}/5
          </span>
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {view.steps.map((step) => {
          const Icon = STEP_ICONS[step.id]
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => handleStepClick(step.id)}
              className={cn(
                "flex min-w-[5.5rem] shrink-0 flex-col items-center gap-1.5 rounded-xl border px-2.5 py-2.5 transition-colors sm:min-w-[6.5rem]",
                step.status === "complete"
                  ? "border-cyan-glow/25 bg-cyan-glow/[0.06]"
                  : step.status === "current"
                    ? "border-cyan-glow/35 bg-cyan-glow/[0.1]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]",
              )}
            >
              <div className="flex items-center gap-1.5">
                <StepIcon complete={step.status === "complete"} />
                <Icon className="size-3.5 text-muted-foreground/60" />
              </div>
              <span className="text-[11px] font-medium text-foreground/90">{step.shortLabel}</span>
            </button>
          )
        })}
      </div>

      {activePanel === "check-in" && (
        <div className="mt-3 space-y-3 rounded-xl border border-white/[0.06] bg-black/20 p-3">
          <p className="text-[11px] text-muted-foreground/80">{view.steps[0]?.hint}</p>
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
                    : "border-white/[0.06] text-muted-foreground/75 hover:border-white/[0.12]",
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
            className="h-9 w-full bg-cyan-glow/90 text-background hover:bg-cyan-glow"
          >
            Complete check-in
          </Button>
        </div>
      )}

      {activePanel === "debrief" && (
        <div className="mt-3 space-y-3 rounded-xl border border-white/[0.06] bg-black/20 p-3">
          <div className="flex flex-wrap gap-3 text-[11px] tabular-nums text-muted-foreground/80">
            <span>{view.debrief.tradeCount} trades today</span>
            <span>
              {view.debrief.winCount}W / {view.debrief.lossCount}L
            </span>
            <span className={view.debrief.todayPnL >= 0 ? "text-profit" : "text-loss"}>
              {formatPnL(Math.abs(view.debrief.todayPnL), view.debrief.todayPnL >= 0 ? "WIN" : "LOSS")}
            </span>
            <span>{view.debrief.rulesFollowedPercent}% rules followed</span>
          </div>
          <div className="rounded-lg border border-cyan-glow/15 bg-cyan-glow/[0.04] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/80">
              Today&apos;s corrective focus
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/90">
              {view.debrief.correctiveAction}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleDebriefComplete}
            disabled={view.debrief.tradeCount === 0}
            className="h-9 w-full border-white/[0.1] bg-white/[0.03]"
          >
            Close today&apos;s session
          </Button>
        </div>
      )}
    </section>
  )
}
