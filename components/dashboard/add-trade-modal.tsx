"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Calculator,
  Sparkles,
  ScanLine,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { ChartUploadThumbnailStrip } from "@/components/ui/chart-upload-thumbnail-strip"
import { MistakeTagBadge } from "@/components/dashboard/mistake-tag-badge"
import { isDangerousMistakeLabel, normalizeMistakeLabel } from "@/lib/mistake-tags"
import {
  EMOTION_OPTIONS,
  MISTAKE_TAGS,
  NOTES_MAX_LENGTH,
  PRIMARY_SESSIONS,
  TRADE_DIRECTIONS,
  TRADE_PAIRS,
  TRADE_RESULTS,
  TRADE_SETUPS,
  TRADE_STRATEGIES,
  TRADING_SESSIONS,
  type TradeFormState,
} from "@/lib/trade-form-config"
import { VyronisCoreModelFields } from "@/components/dashboard/vyronis-core-model-fields"
import { Strategy1PreTradeChecklistPanel } from "@/components/dashboard/strategy1-pre-trade-checklist-panel"
import {
  StrategyNameSelect,
} from "@/components/dashboard/strategy-name-select"
import { TradeJournalModeTabs } from "@/components/dashboard/trade-journal-mode-tabs"
import {
  journalModeDescription,
  submitLabel,
  type TradeJournalMode,
} from "@/lib/trade-journal-mode"
import {
  calculatePositionSize,
  calculateRiskReward,
  formatRiskReward,
  suggestPnLFromResult,
} from "@/lib/trade-form-utils"
import { cn } from "@/lib/utils"
import { PlanMatchPrompt } from "@/components/trade-planner/plan-match-prompt"
import {
  filterActivePlansForTrade,
  type MatchableTradePlan,
} from "@/lib/trade-planner/plan-match"
import {
  disciplineGradeLabel,
  type PlanDisciplineResult,
} from "@/lib/trade-planner/deviation-engine"
import { disciplineGradeBoxClass } from "@/lib/trade-planner/plan-streak"

const PLAN_MODE_HINT_KEY = "seenPlanModeHint"

export type PostSaveDisciplineSummary = {
  result: PlanDisciplineResult
  tradeDetailHref?: string
}

type AddTradeModalProps = {
  open: boolean
  onClose: () => void
  form: TradeFormState
  onFormChange: (updates: Partial<TradeFormState>) => void
  onSubmit: (e: React.FormEvent) => void
  isSubmitting: boolean
  isEditing: boolean
  startingBalance: number
  maxRiskPerTrade?: number
  isUploading: boolean
  uploadProgress: number
  isDragging: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onScreenshotUpload: (file: File) => void
  onScreenshotRemove: () => void
  onScreenshotPreview: () => void
  onReflectionChartUpload: (file: File) => void
  onReflectionChartRemove: () => void
  onReflectionChartPreview: () => void
  onOpenCoach?: () => void
  hasCoachSession?: boolean
  canRepeatLast?: boolean
  repeatSourceLabel?: string
  onRepeatLast?: () => void
  onMt5Autofill?: () => void
  isMt5Autofilling?: boolean
  journalMode?: TradeJournalMode
  onJournalModeChange?: (mode: TradeJournalMode) => void
  existingStrategyNames?: string[]
  linkedPlan?: MatchableTradePlan | null
  onLinkedPlanChange?: (plan: MatchableTradePlan | null) => void
  postSaveDiscipline?: PostSaveDisciplineSummary | null
}

function PostLogDisciplineInline({
  result,
  tradeDetailHref,
}: PostSaveDisciplineSummary) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border text-base font-semibold tabular-nums",
            disciplineGradeBoxClass(result.grade),
          )}
        >
          {result.grade}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary">
            {result.score}/100 · {disciplineGradeLabel(result.grade)}
          </p>
          {tradeDetailHref ? (
            <Link href={tradeDetailHref} className="text-[11px] text-text-accent hover:underline">
              See full breakdown →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="section-label">{children}</p>
}

const EMOTION_ACTIVE_STYLES: Record<string, string> = {
  Calm: "border-emerald-400/40 bg-emerald-400/[0.12] text-emerald-200",
  Confident: "border-cyan-glow/40 bg-cyan-glow/[0.12] text-cyan-glow",
  Fearful: "border-violet-400/40 bg-violet-400/[0.12] text-violet-200",
  Revenge: "border-orange-400/40 bg-orange-400/[0.12] text-orange-200",
  Impulsive: "border-yellow-400/40 bg-yellow-400/[0.12] text-yellow-200",
  Overconfident: "border-rose-400/40 bg-rose-400/[0.12] text-rose-200",
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <Label className="mb-1 block text-[10px] font-medium text-text-muted">
      {children}
      {required && <span className="ml-1 text-[var(--color-loss)]">*</span>}
    </Label>
  )
}

function EmotionPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-3">
        {EMOTION_OPTIONS.map((option) => {
          const active = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-lg border px-1.5 py-2 text-center transition-all duration-200",
                active
                  ? cn(
                      "shadow-[0_0_16px_rgb(from_var(--color-accent)_r_g_b_/_0.12)]",
                      EMOTION_ACTIVE_STYLES[option.value] ??
                        "border-cyan-glow/40 bg-cyan-glow/[0.12]",
                    )
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]",
              )}
            >
              <span
                className={cn("mx-auto mb-1 block size-2 rounded-full", option.dotClass)}
                aria-hidden="true"
              />
              <span className="block truncate text-[10px] text-muted-foreground/80">{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function AddTradeModal({
  open,
  onClose,
  form,
  onFormChange,
  onSubmit,
  isSubmitting,
  isEditing,
  startingBalance,
  maxRiskPerTrade = 1,
  isUploading,
  uploadProgress,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onScreenshotUpload,
  onScreenshotRemove,
  onScreenshotPreview,
  onReflectionChartUpload,
  onReflectionChartRemove,
  onReflectionChartPreview,
  onOpenCoach,
  hasCoachSession = false,
  canRepeatLast = false,
  repeatSourceLabel,
  onRepeatLast,
  onMt5Autofill,
  isMt5Autofilling = false,
  journalMode = "log",
  onJournalModeChange,
  existingStrategyNames = [],
  linkedPlan = null,
  onLinkedPlanChange,
  postSaveDiscipline = null,
}: AddTradeModalProps) {
  const [logSetupOpen, setLogSetupOpen] = useState(false)
  const [showPlanHint, setShowPlanHint] = useState(false)
  const [savedPlans, setSavedPlans] = useState<MatchableTradePlan[]>([])
  const [matchDismissed, setMatchDismissed] = useState(false)
  const [manualLinkOpen, setManualLinkOpen] = useState(false)

  const isPlan = journalMode === "plan"
  const isLog = journalMode === "log"
  const isEdit = journalMode === "edit"
  const showPlanFlow = isPlan || isEdit
  const showLogFlow = isLog || isEdit
  const showChecklist = isPlan || isEdit
  const showVyronisPrimary = isPlan || isEdit
  const riskReward = useMemo(() => calculateRiskReward(form), [form])
  const positionSize = useMemo(
    () => calculatePositionSize(form, startingBalance),
    [form, startingBalance],
  )

  const resultTone =
    form.result === "WIN" ? "profit" : form.result === "LOSS" ? "loss" : "neutral"

  const riskPercent = parseFloat(form.risk_percent)
  const isRiskTooHigh = Number.isFinite(riskPercent) && riskPercent > maxRiskPerTrade
  const rrBelowMinimum = riskReward != null && riskReward < 2

  useEffect(() => {
    if (!open || isEditing) {
      setShowPlanHint(false)
      return
    }
    if (typeof window === "undefined") return
    if (window.localStorage.getItem(PLAN_MODE_HINT_KEY) === "1") return
    setShowPlanHint(true)
  }, [open, isEditing])

  useEffect(() => {
    if (!open || !isLog || isEditing) {
      setSavedPlans([])
      setMatchDismissed(false)
      setManualLinkOpen(false)
      if (!open) onLinkedPlanChange?.(null)
      return
    }

    let cancelled = false

    async function loadPlans() {
      try {
        const response = await fetch("/api/trade-plans")
        if (!response.ok || cancelled) return
        const payload = (await response.json()) as { plans?: MatchableTradePlan[] }
        if (!cancelled) setSavedPlans(payload.plans ?? [])
      } catch {
        if (!cancelled) setSavedPlans([])
      }
    }

    void loadPlans()

    return () => {
      cancelled = true
    }
  }, [open, isLog, isEditing])

  useEffect(() => {
    setMatchDismissed(false)
  }, [form.pair, form.trade_date])

  const matchedPlans = useMemo(
    () =>
      filterActivePlansForTrade(savedPlans, {
        pair: form.pair,
        tradeDate: form.trade_date || new Date().toISOString().split("T")[0],
      }),
    [savedPlans, form.pair, form.trade_date],
  )

  function dismissPlanHint() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PLAN_MODE_HINT_KEY, "1")
    }
    setShowPlanHint(false)
  }

  const toggleMistakeTag = (tag: string) => {
    const exists = form.mistake_tags.includes(tag)
    onFormChange({
      mistake_tags: exists
        ? form.mistake_tags.filter((t) => t !== tag)
        : [...form.mistake_tags, tag],
    })
  }

  const applySuggestedPnL = () => {
    const suggested = suggestPnLFromResult(form, startingBalance, riskReward)
    if (suggested) onFormChange({ pnl: suggested })
  }

  if (!open) return null

  const headerSub =
    form.pair && form.direction
      ? `${form.pair} · ${form.direction}${isPlan ? " · before entry" : isLog ? " · after close" : ""}`
      : journalModeDescription(journalMode)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="add-trade-backdrop absolute inset-0" onClick={onClose} aria-hidden />

      <div
        className={cn(
          "add-trade-modal relative flex max-h-[100dvh] w-full max-w-[560px] flex-col overflow-hidden sm:max-h-[94vh]",
          resultTone === "profit" && "add-trade-modal-win",
          resultTone === "loss" && "add-trade-modal-loss",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-trade-title"
      >
        {!isEditing && onJournalModeChange ? (
          <TradeJournalModeTabs
            mode={journalMode}
            onChange={onJournalModeChange}
            disabled={isSubmitting || isUploading}
            showPlanHint={showPlanHint}
            onDismissPlanHint={dismissPlanHint}
          />
        ) : null}

        <div className="relative shrink-0 border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="add-trade-title" className="text-[15px] font-medium text-text-primary">
                {isEditing ? "Edit trade" : isPlan ? "Setup scoring" : isLog ? "Log result" : "Add trade"}
              </h2>
              <p className="mt-0.5 text-[11px] text-text-muted">{headerSub}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--radius-sm)] p-1.5 text-text-muted transition-colors hover:text-text-primary"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="relative flex min-h-0 flex-1 flex-col">
          <div className="mobile-safe-scroll min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4 sm:space-y-5">
            <section className="add-trade-section space-y-3">
              <SectionLabel>{isLog ? "Trade" : "Market setup"}</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel required>Pair</FieldLabel>
                  <Select value={form.pair} onValueChange={(v) => onFormChange({ pair: v })}>
                    <SelectTrigger className="add-trade-input h-10">
                      <SelectValue placeholder="Select pair" />
                    </SelectTrigger>
                    <SelectContent className="glass-card max-h-60 border-white/[0.08]">
                      {TRADE_PAIRS.map((pair) => (
                        <SelectItem key={pair} value={pair} className="focus:bg-cyan-glow/10">
                          {pair}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <FieldLabel required>Direction</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {TRADE_DIRECTIONS.map((direction) => {
                      const active = form.direction === direction
                      const isBuy = direction === "BUY"
                      return (
                        <button
                          key={direction}
                          type="button"
                          onClick={() => onFormChange({ direction })}
                          className={cn(
                            "flex h-10 items-center justify-center gap-2 rounded-lg border text-[13px] font-semibold transition-all duration-200",
                            active && isBuy
                              ? "border-profit/40 bg-profit/[0.12] text-profit shadow-[0_0_16px_rgb(from var(--color-profit) r g b / 0.12)]"
                              : active && !isBuy
                                ? "border-loss/40 bg-loss/[0.12] text-loss shadow-[0_0_16px_rgb(from var(--color-loss) r g b / 0.12)]"
                                : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/[0.12]",
                          )}
                        >
                          {isBuy ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                          {direction}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {isLog && !isEditing && form.pair ? (
                <PlanMatchPrompt
                  pair={form.pair}
                  matchedPlans={matchedPlans}
                  selectedPlanId={linkedPlan?.id ?? null}
                  dismissed={matchDismissed}
                  manualOpen={manualLinkOpen}
                  onManualOpenChange={setManualLinkOpen}
                  onConfirm={(plan) => onLinkedPlanChange?.(plan)}
                  onDismiss={() => setMatchDismissed(true)}
                  onSkip={() => {
                    setMatchDismissed(true)
                    onLinkedPlanChange?.(null)
                  }}
                  onSelectPlan={(plan) => onLinkedPlanChange?.(plan)}
                  onClearSelection={() => onLinkedPlanChange?.(null)}
                />
              ) : null}

              {isLog ? (
                <div className="space-y-2">
                  <FieldLabel>Strategy</FieldLabel>
                  <StrategyNameSelect
                    value={form.strategy_name}
                    existingNames={existingStrategyNames}
                    onChange={(strategy_name) => onFormChange({ strategy_name })}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <FieldLabel>Session</FieldLabel>
                <div className="grid grid-cols-3 gap-2">
                  {PRIMARY_SESSIONS.map((session) => (
                    <button
                      key={session}
                      type="button"
                      onClick={() => onFormChange({ session })}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-[11px] font-medium transition-all duration-200",
                        form.session === session
                          ? "border-cyan-glow/35 bg-cyan-glow/[0.1] text-cyan-glow"
                          : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-cyan-glow/20",
                      )}
                    >
                      {session}
                    </button>
                  ))}
                </div>
                <Select value={form.session} onValueChange={(v) => onFormChange({ session: v })}>
                  <SelectTrigger className="add-trade-input h-9">
                    <SelectValue placeholder="All sessions" />
                  </SelectTrigger>
                  <SelectContent className="glass-card border-white/[0.08]">
                    {TRADING_SESSIONS.map((session) => (
                      <SelectItem key={session} value={session}>
                        {session}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showPlanFlow && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Strategy</FieldLabel>
                  <Select value={form.strategy_name} onValueChange={(v) => onFormChange({ strategy_name: v })}>
                    <SelectTrigger className="add-trade-input h-10">
                      <SelectValue placeholder="Select strategy" />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-white/[0.08]">
                      {TRADE_STRATEGIES.map((strategy) => (
                        <SelectItem key={strategy} value={strategy}>
                          {strategy}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Setup</FieldLabel>
                  <Select value={form.setup} onValueChange={(v) => onFormChange({ setup: v })}>
                    <SelectTrigger className="add-trade-input h-10">
                      <SelectValue placeholder="Setup quality" />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-white/[0.08]">
                      {TRADE_SETUPS.map((setup) => (
                        <SelectItem key={setup} value={setup}>
                          {setup}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              )}
            </section>

            {showPlanFlow && (
            <section className="add-trade-section space-y-3">
              <SectionLabel>Execution & risk</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { key: "entry_price" as const, label: "Entry price" },
                  { key: "stop_loss" as const, label: "Stop loss" },
                  { key: "take_profit" as const, label: "Take profit" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <FieldLabel>{label}</FieldLabel>
                    <Input
                      type="number"
                      step="0.00001"
                      value={form[key]}
                      onChange={(e) => onFormChange({ [key]: e.target.value })}
                      className="add-trade-input h-10 tabular-nums"
                      placeholder="0.00000"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DashboardInsetPanel className="glass border-cyan-glow/15 bg-cyan-glow/[0.04]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Target className="size-3.5 text-cyan-glow" />
                      <span className="text-[11px] font-medium text-muted-foreground/80">Auto R:R</span>
                    </div>
                    <span className="text-lg font-semibold tabular-nums text-cyan-glow">
                      {formatRiskReward(riskReward)}
                    </span>
                  </div>
                </DashboardInsetPanel>

                <DashboardInsetPanel className="glass border-white/[0.06]">
                  <div className="flex items-start gap-2">
                    <Calculator className="mt-0.5 size-3.5 shrink-0 text-cyan-glow" />
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] font-medium text-muted-foreground/80">Position size helper</p>
                      {positionSize ? (
                        <>
                          <p className="text-[12px] font-semibold tabular-nums text-foreground">
                            {positionSize.units.toFixed(2)} units
                          </p>
                          <p className="text-[10px] text-muted-foreground/65">
                            Risk ${positionSize.riskAmount.toFixed(2)} · Stop distance {positionSize.pipRisk.toFixed(5)}
                          </p>
                        </>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/60">Enter entry, stop, and risk %</p>
                      )}
                    </div>
                  </div>
                </DashboardInsetPanel>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel required>Risk %</FieldLabel>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={form.risk_percent}
                    onChange={(e) => onFormChange({ risk_percent: e.target.value })}
                    className={cn(
                      "add-trade-input h-10 tabular-nums",
                      isRiskTooHigh && "border-loss/40 text-loss",
                    )}
                  />
                  {isRiskTooHigh && (
                    <p className="flex items-center gap-1 text-[10px] text-loss">
                      <AlertTriangle className="size-3" />
                      Risk above {maxRiskPerTrade}%
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <FieldLabel>Trade date</FieldLabel>
                  <Input
                    type="date"
                    value={form.trade_date}
                    onChange={(e) => onFormChange({ trade_date: e.target.value })}
                    className="dashboard-date-input add-trade-input h-10 border-white/[0.08] text-white"
                  />
                </div>
              </div>
            </section>
            )}

            {showChecklist && (
              <Strategy1PreTradeChecklistPanel
                form={form}
                riskReward={riskReward}
                defaultOpen
              />
            )}

            {showVyronisPrimary && (
            <VyronisCoreModelFields
              form={form}
              onFormChange={onFormChange}
              rrWarning={rrBelowMinimum}
            />
            )}

            {isLog && (
              <DashboardInsetPanel className="overflow-hidden border-white/[0.08] p-0">
                <button
                  type="button"
                  onClick={() => setLogSetupOpen((v) => !v)}
                  className="flex w-full items-center justify-between px-3 py-3 text-left sm:px-4"
                >
                  <div>
                    <p className="text-[11px] font-semibold text-foreground/90">Setup details (optional)</p>
                    <p className="text-[10px] text-muted-foreground/65">
                      Add HTF & confirmation for a stronger Vyronis score
                    </p>
                  </div>
                  <span className="text-[10px] text-cyan-glow">{logSetupOpen ? "Hide" : "Show"}</span>
                </button>
                {logSetupOpen && (
                  <div className="space-y-4 border-t border-white/[0.06] px-3 pb-3 sm:px-4 sm:pb-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {[
                        { key: "entry_price" as const, label: "Entry" },
                        { key: "stop_loss" as const, label: "Stop" },
                        { key: "take_profit" as const, label: "Target" },
                      ].map(({ key, label }) => (
                        <div key={key} className="space-y-1.5">
                          <FieldLabel>{label}</FieldLabel>
                          <Input
                            type="number"
                            step="0.00001"
                            value={form[key]}
                            onChange={(e) => onFormChange({ [key]: e.target.value })}
                            className="add-trade-input h-9 tabular-nums"
                          />
                        </div>
                      ))}
                    </div>
                    <VyronisCoreModelFields
                      form={form}
                      onFormChange={onFormChange}
                      rrWarning={rrBelowMinimum}
                    />
                  </div>
                )}
              </DashboardInsetPanel>
            )}

            {isPlan && (
            <section className="add-trade-section space-y-3">
              <SectionLabel>Before entry</SectionLabel>
              <EmotionPicker
                label="Emotion before trade"
                value={form.emotion}
                onChange={(emotion) => onFormChange({ emotion })}
              />
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3 transition-colors",
                  form.rule_followed
                    ? "border-profit/25 bg-profit/[0.06]"
                    : "border-loss/25 bg-loss/[0.06]",
                )}
              >
                <span className="text-[12px] font-medium text-foreground/90">Rules followed (plan)</span>
                <Switch
                  checked={form.rule_followed}
                  onCheckedChange={(checked) => onFormChange({ rule_followed: checked })}
                  className="data-[state=checked]:bg-profit data-[state=unchecked]:bg-loss"
                />
              </div>
            </section>
            )}

            {showLogFlow && (
            <section className="add-trade-section space-y-3">
              <SectionLabel>Outcome</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {TRADE_RESULTS.map((result) => {
                  const active = form.result === result.value
                  return (
                    <button
                      key={result.value}
                      type="button"
                      onClick={() => {
                        const updates: Partial<TradeFormState> = { result: result.value }
                        const suggested = suggestPnLFromResult(
                          { ...form, result: result.value },
                          startingBalance,
                          riskReward,
                        )
                        if (suggested && !form.pnl) updates.pnl = suggested
                        onFormChange(updates)
                      }}
                      className={cn(
                        "rounded-lg border py-2.5 text-[12px] font-bold tracking-wide transition-all duration-200",
                        active && result.tone === "profit"
                          ? "border-profit/40 bg-profit/[0.12] text-profit shadow-[0_0_18px_rgb(from var(--color-profit) r g b / 0.14)]"
                          : active && result.tone === "loss"
                            ? "border-loss/40 bg-loss/[0.12] text-loss shadow-[0_0_18px_rgb(from var(--color-loss) r g b / 0.14)]"
                            : active
                              ? "border-white/20 bg-white/[0.06] text-foreground"
                              : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/[0.12]",
                      )}
                    >
                      {result.label}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel required>P&L ($)</FieldLabel>
                  <button
                    type="button"
                    onClick={applySuggestedPnL}
                    className="text-[10px] font-medium text-cyan-glow transition-colors hover:text-cyan-glow/80"
                  >
                    Auto-fill from risk
                  </button>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={form.pnl}
                  onChange={(e) => onFormChange({ pnl: e.target.value })}
                  className={cn(
                    "add-trade-input h-10 tabular-nums",
                    form.result === "LOSS" && "text-loss",
                    form.result === "WIN" && "text-profit",
                  )}
                  placeholder="150.00"
                />
              </div>

              <div
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3 transition-colors",
                  form.rule_followed
                    ? "border-profit/25 bg-profit/[0.06]"
                    : "border-loss/25 bg-loss/[0.06]",
                )}
              >
                <span className="text-[12px] font-medium text-foreground/90">Rules followed</span>
                <Switch
                  checked={form.rule_followed}
                  onCheckedChange={(checked) => onFormChange({ rule_followed: checked })}
                  className="data-[state=checked]:bg-profit data-[state=unchecked]:bg-loss"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Trade date</FieldLabel>
                <Input
                  type="date"
                  value={form.trade_date}
                  onChange={(e) => onFormChange({ trade_date: e.target.value })}
                  className="dashboard-date-input add-trade-input h-10 border-white/[0.08] text-white"
                />
              </div>
            </section>
            )}

            {showLogFlow && (
            <section className="add-trade-section space-y-3">
              <SectionLabel>After trade</SectionLabel>
              <EmotionPicker
                label="Emotion before trade"
                value={form.emotion}
                onChange={(emotion) => onFormChange({ emotion })}
              />
              <EmotionPicker
                label="Emotion after trade"
                value={form.emotion_after}
                onChange={(emotion_after) => onFormChange({ emotion_after })}
              />

              <div className="space-y-2">
                <FieldLabel>Mistake tags</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {MISTAKE_TAGS.map((tag) => {
                    const active = form.mistake_tags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleMistakeTag(tag)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all duration-200",
                          active
                            ? isDangerousMistakeLabel(normalizeMistakeLabel(tag))
                              ? "border-loss/35 bg-loss/[0.12] text-loss shadow-[0_0_12px_rgb(from var(--color-loss) r g b / 0.18)]"
                              : "border-warning/35 bg-warning/[0.12] text-warning-foreground"
                            : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-warning/20",
                        )}
                      >
                        {normalizeMistakeLabel(tag)}
                      </button>
                    )
                  })}
                </div>
                {form.mistake_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {form.mistake_tags.map((tag) => (
                      <MistakeTagBadge
                        key={tag}
                        tag={{
                          id: tag,
                          label: normalizeMistakeLabel(tag),
                          dangerous: isDangerousMistakeLabel(tag),
                          source: "tag",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FieldLabel>Trade notes</FieldLabel>
                  <span className="text-[10px] tabular-nums text-muted-foreground/60">
                    {form.trade_notes.length}/{NOTES_MAX_LENGTH}
                  </span>
                </div>
                <Textarea
                  value={form.trade_notes}
                  onChange={(e) =>
                    onFormChange({ trade_notes: e.target.value.slice(0, NOTES_MAX_LENGTH) })
                  }
                  placeholder="What happened? What would you repeat or avoid?"
                  className="add-trade-input min-h-[96px] resize-none"
                />
              </div>
            </section>
            )}

            <section className="add-trade-section space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <FieldLabel>Chart / MT5 screenshot</FieldLabel>
                {form.screenshot_url && onMt5Autofill ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploading || isMt5Autofilling || isSubmitting}
                    onClick={onMt5Autofill}
                    className="h-8 border-cyan-glow/30 bg-cyan-glow/[0.06] text-[11px] text-cyan-glow hover:bg-cyan-glow/[0.12]"
                  >
                    {isMt5Autofilling ? (
                      <span className="flex items-center gap-1.5">
                        <span className="size-3.5 animate-spin rounded-full border-2 border-cyan-glow/30 border-t-cyan-glow" />
                        Reading MT5…
                      </span>
                    ) : (
                      <>
                        <ScanLine className="mr-1.5 size-3.5" />
                        Re-run MT5 autofill
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
              {form.screenshot_url ? (
                <>
                  <div className="sm:hidden">
                    <ChartUploadThumbnailStrip
                      items={[
                        {
                          id: "screenshot",
                          url: form.screenshot_url,
                          label: "Chart",
                          alt: "Trade chart",
                        },
                      ]}
                      countLabel="1 chart uploaded"
                      onRemove={() => onScreenshotRemove()}
                      onPreview={() => onScreenshotPreview()}
                      disabled={isUploading}
                      canAdd={false}
                    />
                  </div>
                  <div className="relative hidden overflow-hidden rounded-xl border border-white/[0.08] bg-black/20 sm:block">
                    <img
                      src={form.screenshot_url}
                      alt="Trade chart"
                      className="dashboard-image-zoom h-36 w-full cursor-pointer object-cover"
                      onClick={onScreenshotPreview}
                    />
                    <button
                      type="button"
                      onClick={onScreenshotRemove}
                      className="absolute right-2 top-2 rounded-lg border border-white/[0.08] bg-background/80 p-1.5 hover:border-loss/40 hover:bg-loss/10"
                    >
                      <X className="size-4 text-muted-foreground" />
                    </button>
                    <Badge className="absolute bottom-2 left-2 border-profit/30 bg-background/80 text-profit">
                      Screenshot attached
                    </Badge>
                  </div>
                </>
              ) : (
                <label
                  className={cn(
                    "add-trade-dropzone flex h-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-300 sm:h-32",
                    isDragging
                      ? "scale-[1.01] border-cyan-glow bg-cyan-glow/[0.1] shadow-[0_0_24px_rgb(from var(--color-accent) r g b / 0.15)]"
                      : "border-white/[0.08] bg-white/[0.02] hover:border-cyan-glow/30 hover:bg-cyan-glow/[0.04]",
                  )}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) onScreenshotUpload(file)
                    }}
                    disabled={isUploading}
                  />
                  {isUploading ? (
                    <div className="flex w-full max-w-xs flex-col items-center gap-2 px-6">
                      <div className="size-8 animate-spin rounded-full border-2 border-cyan-glow/30 border-t-cyan-glow" />
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-glow to-profit transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-cyan-glow">{uploadProgress}% uploading</span>
                    </div>
                  ) : (
                    <>
                      <Upload className={cn("size-6", isDragging ? "text-cyan-glow" : "text-muted-foreground/60")} />
                      <p className="mt-2 text-center text-[12px] text-muted-foreground/80">
                        {isDragging
                          ? "Drop screenshot here"
                          : "MT5 screenshot — uploads and autofills pair, entry, SL, TP"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/50">PNG, JPG, WebP up to 10MB</p>
                    </>
                  )}
                </label>
              )}
            </section>

            <section className="add-trade-section space-y-2">
              <FieldLabel>TradingView reflection chart</FieldLabel>
              {form.reflection_chart_url ? (
                <>
                  <div className="sm:hidden">
                    <ChartUploadThumbnailStrip
                      items={[
                        {
                          id: "reflection",
                          url: form.reflection_chart_url,
                          label: "Reflection",
                          alt: "TradingView reflection chart",
                        },
                      ]}
                      countLabel="1 reflection chart"
                      onRemove={() => onReflectionChartRemove()}
                      onPreview={() => onReflectionChartPreview()}
                      disabled={isUploading}
                      canAdd={false}
                    />
                  </div>
                  <div className="relative hidden overflow-hidden rounded-xl border border-violet-400/20 bg-black/20 sm:block">
                    <img
                      src={form.reflection_chart_url}
                      alt="TradingView reflection chart"
                      className="max-h-48 w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-3">
                      <p className="text-[11px] text-violet-100/90">TradingView reflection</p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 border-white/15 bg-black/40 text-[11px]"
                          onClick={onReflectionChartPreview}
                        >
                          Preview
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 border-white/15 bg-black/40 text-[11px]"
                          onClick={onReflectionChartRemove}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <label
                  className={cn(
                    "flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 transition-all",
                    "border-violet-400/20 bg-violet-500/[0.04] hover:border-violet-400/35 hover:bg-violet-500/[0.07]",
                  )}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) onReflectionChartUpload(file)
                    }}
                    disabled={isUploading}
                  />
                  <Upload className="size-6 text-violet-300/70" />
                  <p className="mt-2 text-center text-[12px] text-muted-foreground/85">
                    TradingView reflection — post-trade chart for journal review
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground/50">PNG, JPG, WebP up to 10MB</p>
                </label>
              )}
            </section>
          </div>

          <div className="mobile-form-footer relative shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-modal)] px-5 py-4">
            {postSaveDiscipline ? (
              <PostLogDisciplineInline {...postSaveDiscipline} />
            ) : (
              <>
                {canRepeatLast && onRepeatLast && !isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onRepeatLast}
                    className="btn-ghost mb-3 h-10 w-full text-[12px]"
                  >
                    Repeat last setup
                    {repeatSourceLabel ? (
                      <span className="ml-1.5 text-muted-foreground/60">· {repeatSourceLabel}</span>
                    ) : null}
                  </Button>
                )}
                {onOpenCoach && !isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onOpenCoach}
                    className="btn-ghost mb-3 h-11 w-full border-cyan-glow/20 text-cyan-glow hover:border-cyan-glow/30 hover:bg-cyan-glow/[0.06]"
                  >
                    <Sparkles className="mr-2 size-4" />
                    {hasCoachSession ? "Continue Pre-Trade Coach" : "Start Pre-Trade Coach"}
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={isSubmitting || isUploading}
                  className="btn-primary mobile-sticky-submit h-10 w-full rounded-[var(--radius-md)] text-[13px] font-medium"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                      {isEditing ? "Updating…" : "Saving…"}
                    </span>
                  ) : (
                    submitLabel(journalMode, isEditing)
                  )}
                </Button>
                <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
                  {isPlan
                    ? "Saves as planned setup (BE · $0) — Vyronis scores your entry plan. Log result later via Edit."
                    : "Vyronis strategy scoring runs automatically when you save"}
                </p>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
