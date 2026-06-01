"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { AlertTriangle, Brain, CheckCircle2, ChevronDown, Loader2, Pencil, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToastAction } from "@/components/ui/toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DashboardEmptyState,
} from "@/components/dashboard/dashboard-primitives"
import { TradePlanVisual } from "@/components/trade-planner/trade-plan-visual"
import type { TradePlanCalculation, TradePlanWarning } from "@/lib/trade-planner/types"
import { PlanChartUploadPanel } from "@/components/trade-planner/plan-chart-upload-panel"
import { TRADE_PLANNER_PAIRS } from "@/lib/trade-planner/forex-pairs"
import {
  buildTradePlanCalculation,
  formatLotSize,
  formatRiskReward,
  parseTradePlanNumber,
} from "@/lib/trade-planner/trade-plan-engine"
import {
  buildPlannedContextFromTradePlannerPrefill,
  buildTradePlannerCoachPrefill,
} from "@/lib/trade-planner/coach-prefill"
import { useAIContext } from "@/providers/ai-context-provider"
import { buildPlanSlCoaching, mergePlanPointers } from "@/lib/trade-planner/plan-sl-coaching"
import type { TradePlanDirection } from "@/lib/trade-planner/types"
import { APP_HOME_PATH } from "@/lib/branding"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import {
  readPlannerDraft,
  writePlannerDraft,
} from "@/lib/trade-planner/planner-draft-storage"
import type { TradingViewPlannerHandoff } from "@/lib/tradingview/signal-planner-handoff"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

type SavedPlanRow = {
  id: string
  pair: string
  direction: TradePlanDirection
  accountSize: number
  riskPercent: number
  entryPrice: number
  stopLoss: number
  takeProfit: number
  slPips: number
  tpPips: number
  rr: number | null
  riskAmount: number
  recommendedLots: number | null
  pipValuePerStandardLot: number
  status: string
  created_at: string
}

type PlannerMobileSection = "setup" | "result" | "chart" | "plans"

const PLANNER_MOBILE_SECTIONS: Array<{ id: PlannerMobileSection; label: string }> = [
  { id: "setup", label: "Setup" },
  { id: "result", label: "Result" },
  { id: "chart", label: "Chart" },
  { id: "plans", label: "Plans" },
]

type TradePlannerWorkspaceProps = {
  initialPair?: string
  tradingViewHandoff?: TradingViewPlannerHandoff | null
  defaultAccountSize?: number
  defaultRiskPercent?: number
  maxRiskPerTrade?: number
  accountSizeReady?: boolean
  skippedBalanceTrades?: number
  onCoachEngaged?: () => void
}

export function TradePlannerWorkspace({
  initialPair,
  tradingViewHandoff = null,
  defaultAccountSize = DEFAULT_USER_SETTINGS.starting_balance,
  defaultRiskPercent = DEFAULT_USER_SETTINGS.max_risk_per_trade,
  maxRiskPerTrade = DEFAULT_USER_SETTINGS.max_risk_per_trade,
  accountSizeReady = false,
  skippedBalanceTrades = 0,
  onCoachEngaged,
}: TradePlannerWorkspaceProps) {
  const { openPreTradeCoach } = useAIContext()
  const { toast } = useToast()
  const [pair, setPair] = useState<string>("EURUSD")
  const [direction, setDirection] = useState<TradePlanDirection>("BUY")
  const [accountSize, setAccountSize] = useState("")
  const [accountSizeTouched, setAccountSizeTouched] = useState(false)
  const [riskTouched, setRiskTouched] = useState(false)
  const [riskPercent, setRiskPercent] = useState(String(defaultRiskPercent))
  const [entryPrice, setEntryPrice] = useState("")
  const [stopLoss, setStopLoss] = useState("")
  const [takeProfit, setTakeProfit] = useState("")
  const [savedPlans, setSavedPlans] = useState<SavedPlanRow[]>([])
  const [pastPlansOpen, setPastPlansOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveUnavailable, setSaveUnavailable] = useState(false)
  const [chartScreenshotUrl, setChartScreenshotUrl] = useState<string | null>(null)
  const [chartPointers, setChartPointers] = useState<string[]>([])
  const [isChartUploading, setIsChartUploading] = useState(false)
  const [isChartAnalyzing, setIsChartAnalyzing] = useState(false)
  const [mobileSection, setMobileSection] = useState<PlannerMobileSection>("setup")
  const [loadedPlanId, setLoadedPlanId] = useState<string | null>(null)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)
  const [draftHydrated, setDraftHydrated] = useState(false)
  const [draftWasRestored, setDraftWasRestored] = useState(false)
  const [tradingViewBanner, setTradingViewBanner] = useState<string | null>(null)
  const draftHydratedRef = useRef(false)
  const setupActionsRef = useRef<HTMLDivElement>(null)

  function applyPlannerChartContext(
    planId: string | null,
    draft?: ReturnType<typeof readPlannerDraft>,
  ) {
    const snapshot = draft ?? readPlannerDraft()
    if (
      snapshot?.chartScreenshotUrl &&
      (planId == null || snapshot.loadedPlanId === planId)
    ) {
      setChartScreenshotUrl(snapshot.chartScreenshotUrl)
      setChartPointers(snapshot.chartPointers)
      return
    }

    setChartScreenshotUrl(null)
    setChartPointers([])
  }

  function scrollSetupActionsIntoView() {
    window.requestAnimationFrame(() => {
      setupActionsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }

  function openPlanInSetup(options?: { scrollToActions?: boolean }) {
    setMobileSection("setup")
    if (options?.scrollToActions) {
      scrollSetupActionsIntoView()
    }
  }

  useEffect(() => {
    if (draftHydratedRef.current) {
      if (initialPair) setPair(initialPair)
      return
    }

    const draft = readPlannerDraft()
    if (draft) {
      setPair(draft.pair)
      setDirection(draft.direction)
      if (draft.accountSize) {
        setAccountSize(draft.accountSize)
        setAccountSizeTouched(true)
      }
      if (draft.riskPercent) {
        setRiskPercent(draft.riskPercent)
        setRiskTouched(true)
      }
      setEntryPrice(draft.entryPrice)
      setStopLoss(draft.stopLoss)
      setTakeProfit(draft.takeProfit)
      setLoadedPlanId(draft.loadedPlanId)
      setEditingPlanId(draft.editingPlanId)
      applyPlannerChartContext(draft.loadedPlanId, draft)
      if (draft.entryPrice || draft.stopLoss || draft.takeProfit) {
        setDraftWasRestored(true)
        setMobileSection("setup")
      }
    }

    if (initialPair) {
      setPair(initialPair)
    }

    draftHydratedRef.current = true
    setDraftHydrated(true)
  }, [initialPair])

  useEffect(() => {
    if (!draftHydrated || !tradingViewHandoff) return

    setPair(tradingViewHandoff.pair)
    setDirection(tradingViewHandoff.direction)
    if (tradingViewHandoff.entryPrice) setEntryPrice(tradingViewHandoff.entryPrice)
    if (tradingViewHandoff.stopLoss) setStopLoss(tradingViewHandoff.stopLoss)
    if (tradingViewHandoff.takeProfit) setTakeProfit(tradingViewHandoff.takeProfit)
    if (tradingViewHandoff.chartUrl) {
      setChartScreenshotUrl(tradingViewHandoff.chartUrl)
      setChartPointers([])
    }
    setDraftWasRestored(false)
    setMobileSection("setup")
    setTradingViewBanner(
      tradingViewHandoff.setupGrade
        ? `TradingView alert loaded · Grade ${tradingViewHandoff.setupGrade}`
        : "TradingView alert loaded into planner",
    )
    scrollSetupActionsIntoView()
  }, [draftHydrated, tradingViewHandoff])

  useEffect(() => {
    if (accountSizeTouched || defaultAccountSize <= 0 || !draftHydrated) return
    setAccountSize(String(defaultAccountSize))
  }, [defaultAccountSize, accountSizeTouched, draftHydrated])

  useEffect(() => {
    if (!draftHydrated || riskTouched) return
    setRiskPercent(String(defaultRiskPercent))
  }, [defaultRiskPercent, draftHydrated, riskTouched])

  useEffect(() => {
    if (!draftHydrated) return

    writePlannerDraft({
      pair,
      direction,
      accountSize,
      riskPercent,
      entryPrice,
      stopLoss,
      takeProfit,
      loadedPlanId,
      editingPlanId,
      chartScreenshotUrl,
      chartPointers,
      updatedAt: Date.now(),
    })
  }, [
    pair,
    direction,
    accountSize,
    riskPercent,
    entryPrice,
    stopLoss,
    takeProfit,
    loadedPlanId,
    editingPlanId,
    chartScreenshotUrl,
    chartPointers,
    draftHydrated,
  ])

  const plan = useMemo(() => {
    return buildTradePlanCalculation({
      pair,
      direction,
      accountSize: parseTradePlanNumber(accountSize),
      riskPercent: parseTradePlanNumber(riskPercent),
      entryPrice: parseTradePlanNumber(entryPrice),
      stopLoss: parseTradePlanNumber(stopLoss),
      takeProfit: parseTradePlanNumber(takeProfit),
    })
  }, [pair, direction, accountSize, riskPercent, entryPrice, stopLoss, takeProfit])

  const displayPointers = useMemo(() => {
    const entry = parseTradePlanNumber(entryPrice)
    const stop = parseTradePlanNumber(stopLoss)
    const target = parseTradePlanNumber(takeProfit)
    if (entry <= 0 || stop <= 0) return chartPointers

    const tips = buildPlanSlCoaching({
      pair,
      direction,
      accountSize: parseTradePlanNumber(accountSize),
      riskPercent: parseTradePlanNumber(riskPercent),
      entryPrice: entry,
      stopLoss: stop,
      takeProfit: target,
    })

    return mergePlanPointers(chartPointers, tips, pair)
  }, [chartPointers, pair, direction, accountSize, riskPercent, entryPrice, stopLoss, takeProfit])

  useEffect(() => {
    void fetch("/api/trade-plans")
      .then(async (res) => {
        if (res.status === 503) {
          setSaveUnavailable(true)
          return { plans: [] }
        }
        return res.ok ? res.json() : { plans: [] }
      })
      .then((data) => setSavedPlans(Array.isArray(data.plans) ? data.plans : []))
      .catch(() => setSavedPlans([]))
  }, [])

  async function sendPlanToCoach(tradePlanId?: string) {
    if (!canCoach) return

    const prefill = buildTradePlannerCoachPrefill(plan, {
      tradePlanId: tradePlanId ?? loadedPlanId ?? undefined,
      chartScreenshotUrl: chartScreenshotUrl,
      chartPointers: displayPointers,
    })
    const plannedContext = buildPlannedContextFromTradePlannerPrefill(prefill, maxRiskPerTrade)

    try {
      await openPreTradeCoach({ plannedContext, plannerCheckIn: true })
      onCoachEngaged?.()
    } catch (error) {
      toast({
        title: "Could not open Coach",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    }
  }

  async function handleChartUpload(file: File) {
    setIsChartUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      })

      if (!uploadResponse.ok) {
        const payload = await uploadResponse.json().catch(() => ({}))
        throw new Error(payload.error || "Upload failed")
      }

      const { url } = (await uploadResponse.json()) as { url: string }
      setChartScreenshotUrl(url)
      setIsChartUploading(false)
      setIsChartAnalyzing(true)

      const autofillResponse = await fetch("/api/trade-planner/chart-autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: url,
          pairHint: pair,
          directionHint: direction,
          accountSize: parseTradePlanNumber(accountSize),
          riskPercent: parseTradePlanNumber(riskPercent),
        }),
      })

      const autofillPayload = await autofillResponse.json().catch(() => ({}))
      if (!autofillResponse.ok) {
        throw new Error(autofillPayload.error || "Chart analysis failed")
      }

      const applied = autofillPayload.applied as
        | {
            pair: string
            direction: TradePlanDirection
            entryPrice: string
            stopLoss: string
            takeProfit: string
          }
        | null

      if (applied) {
        setPair(applied.pair)
        setDirection(applied.direction)
        if (applied.entryPrice) setEntryPrice(applied.entryPrice)
        if (applied.stopLoss) setStopLoss(applied.stopLoss)
        if (applied.takeProfit) setTakeProfit(applied.takeProfit)
      }

      setChartPointers(Array.isArray(autofillPayload.pointers) ? autofillPayload.pointers : [])

      toast({
        title: applied ? "Chart levels loaded" : "Chart uploaded",
        description: applied
          ? `${applied.pair} ${applied.direction} — review SL pointers before saving.`
          : autofillPayload.vision?.summary ||
            "Could not read prices — enter entry, SL, and TP manually.",
        variant: applied ? "default" : "destructive",
      })
    } catch (error) {
      toast({
        title: "Chart upload failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setIsChartUploading(false)
      setIsChartAnalyzing(false)
    }
  }

  async function handleSavePlan() {
    setIsSaving(true)
    try {
      const payload = {
        pair,
        direction,
        accountSize: parseTradePlanNumber(accountSize),
        riskPercent: parseTradePlanNumber(riskPercent),
        entryPrice: parseTradePlanNumber(entryPrice),
        stopLoss: parseTradePlanNumber(stopLoss),
        takeProfit: parseTradePlanNumber(takeProfit),
      }

      const isUpdate = Boolean(editingPlanId)
      const response = await fetch(
        isUpdate ? `/api/trade-plans/${editingPlanId}` : "/api/trade-plans",
        {
          method: isUpdate ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isUpdate ? { action: "update", ...payload } : payload),
        },
      )

      const data = await response.json()
      if (response.status === 503 || data.code === "MIGRATION_PENDING") {
        setSaveUnavailable(true)
        return
      }
      if (!response.ok) {
        throw new Error(data.error || (isUpdate ? "Failed to update plan" : "Failed to save plan"))
      }

      setSavedPlans((current) => {
        if (isUpdate) {
          return current.map((row) => (row.id === data.plan.id ? (data.plan as SavedPlanRow) : row))
        }
        return [data.plan, ...current].slice(0, 20)
      })
      setLoadedPlanId(String(data.plan.id))
      setEditingPlanId(null)
      openPlanInSetup({ scrollToActions: true })
      toast({
        title: isUpdate ? "Pre-trade plan updated" : "Pre-trade plan saved",
        description: isUpdate
          ? `${data.plan.pair} ${data.plan.direction} changes saved.`
          : "Stored separately from your post-trade journal.",
        action: isUpdate ? undefined : (
          <ToastAction
            altText="Run Coach check-in"
            onClick={() => void sendPlanToCoach(String(data.plan.id))}
          >
            Run Coach
          </ToastAction>
        ),
      })
    } catch (error) {
      toast({
        title: editingPlanId ? "Could not update plan" : "Could not save plan",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const canCoach =
    plan.entryPrice > 0 && plan.stopLoss > 0 && plan.takeProfit > 0 && plan.pair.length > 0

  const canSave = canCoach && !saveUnavailable

  const activePlans = useMemo(
    () => savedPlans.filter((row) => row.status === "active"),
    [savedPlans],
  )
  const pastPlans = useMemo(
    () => savedPlans.filter((row) => row.status !== "active"),
    [savedPlans],
  )

  const plannerInputClass = "planner-input w-full"
  const selectTriggerClass =
    "h-9 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-input)] text-[13px] font-medium text-text-primary"
  const consolidatedWarning = getConsolidatedPlanWarning(plan.warnings)

  function loadSavedPlan(saved: SavedPlanRow) {
    setPair(saved.pair)
    setDirection(saved.direction)
    setAccountSizeTouched(true)
    setAccountSize(formatSavedPlanInput(saved.accountSize))
    setRiskTouched(true)
    setRiskPercent(formatSavedPlanInput(saved.riskPercent))
    setEntryPrice(formatSavedPlanInput(saved.entryPrice))
    setStopLoss(formatSavedPlanInput(saved.stopLoss))
    setTakeProfit(formatSavedPlanInput(saved.takeProfit))
    setLoadedPlanId(saved.id)
    setEditingPlanId(null)
    setDraftWasRestored(false)
    applyPlannerChartContext(saved.id)
    openPlanInSetup({ scrollToActions: true })
    toast({
      title: "Saved plan opened",
      description: `${saved.pair} ${saved.direction} · ${formatRiskReward(saved.rr)} · ${formatLotSize(saved.recommendedLots)} lots`,
    })
  }

  function editSavedPlan(saved: SavedPlanRow) {
    setPair(saved.pair)
    setDirection(saved.direction)
    setAccountSizeTouched(true)
    setAccountSize(formatSavedPlanInput(saved.accountSize))
    setRiskTouched(true)
    setRiskPercent(formatSavedPlanInput(saved.riskPercent))
    setEntryPrice(formatSavedPlanInput(saved.entryPrice))
    setStopLoss(formatSavedPlanInput(saved.stopLoss))
    setTakeProfit(formatSavedPlanInput(saved.takeProfit))
    setLoadedPlanId(saved.id)
    setEditingPlanId(saved.id)
    setDraftWasRestored(false)
    applyPlannerChartContext(saved.id)
    openPlanInSetup({ scrollToActions: true })
    toast({
      title: "Editing saved plan",
      description: `${saved.pair} ${saved.direction} — review pointers, then Update or Analyze.`,
    })
  }

  async function deleteSavedPlan(saved: SavedPlanRow) {
    if (
      !window.confirm(
        `Delete ${saved.pair} ${saved.direction} plan from ${new Date(saved.created_at).toLocaleString(undefined, {
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}?`,
      )
    ) {
      return
    }

    setDeletingPlanId(saved.id)
    try {
      const response = await fetch(`/api/trade-plans/${saved.id}`, { method: "DELETE" })
      const data = await response.json().catch(() => ({}))
      if (response.status === 503 || data.code === "MIGRATION_PENDING") {
        setSaveUnavailable(true)
        return
      }
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete plan")
      }

      setSavedPlans((current) => current.filter((row) => row.id !== saved.id))
      if (loadedPlanId === saved.id) {
        setLoadedPlanId(null)
        setEditingPlanId(null)
      }
      toast({
        title: "Plan deleted",
        description: `${saved.pair} ${saved.direction} removed from recent plans.`,
      })
    } catch (error) {
      toast({
        title: "Could not delete plan",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setDeletingPlanId(null)
    }
  }

  function startNewPlan() {
    setLoadedPlanId(null)
    setEditingPlanId(null)
    setMobileSection("setup")
  }

  function cancelEditPlan() {
    setEditingPlanId(null)
    setMobileSection("plans")
  }

  const loadedPlan = useMemo(
    () => savedPlans.find((row) => row.id === loadedPlanId) ?? null,
    [savedPlans, loadedPlanId],
  )

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-[var(--radius-md)] border px-3.5 py-3",
          saveUnavailable
            ? "border-[var(--warning-border)] bg-[var(--warning-bg)]"
            : "border-[var(--warning-border)] bg-[var(--warning-bg)]",
        )}
      >
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" />
        <div className="min-w-0 text-[12px] leading-relaxed text-warning-muted">
          {saveUnavailable ? (
            <>
              <span className="font-medium text-warning-foreground">Planner saving unavailable — migration pending.</span>{" "}
              Run <code className="text-[11px] text-warning-muted">supabase/030-trade-plans.sql</code> in Supabase.
              Planning and calculations still work.
            </>
          ) : (
            <>
              Pre-trade sizing only — log outcome after close.{" "}
              <Link
                href={`${APP_HOME_PATH}?action=new-trade`}
                className="font-medium text-warning-foreground underline underline-offset-2 hover:no-underline"
              >
                Log Trade →
              </Link>
            </>
          )}
        </div>
      </div>

      <PlannerMobileSectionNav
        activeSection={mobileSection}
        onSectionChange={setMobileSection}
        resultSummary={
          plan.recommendedLots != null
            ? `${formatRiskReward(plan.rr)} · ${formatLotSize(plan.recommendedLots)} lots`
            : plan.riskAmount > 0
              ? `$${plan.riskAmount.toFixed(0)} risk`
              : null
        }
      />

      {loadedPlan ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-text-accent">
              {editingPlanId ? "Editing saved plan" : "Viewing saved plan"}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-text-muted">
              {loadedPlan.pair} · {loadedPlan.direction} ·{" "}
              {new Date(loadedPlan.created_at).toLocaleString(undefined, {
                month: "numeric",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {editingPlanId ? (
              <button
                type="button"
                onClick={cancelEditPlan}
                className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-input)] px-2.5 py-1 text-[10px] text-text-primary hover:bg-white/[0.04]"
              >
                Cancel edit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => editSavedPlan(loadedPlan)}
                className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-input)] px-2.5 py-1 text-[10px] text-text-primary hover:bg-white/[0.04]"
              >
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={startNewPlan}
              className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-input)] px-2.5 py-1 text-[10px] text-text-primary hover:bg-white/[0.04]"
            >
              Start new plan
            </button>
          </div>
        </div>
      ) : null}

      {tradingViewBanner ? (
        <div className="rounded-[var(--radius-md)] border border-cyan-glow/25 bg-cyan-glow/[0.06] px-3 py-2 text-[10px] text-cyan-glow">
          {tradingViewBanner}
        </div>
      ) : null}

      {draftWasRestored && !loadedPlan && !tradingViewHandoff ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-input)] px-3 py-2 text-[10px] text-text-muted">
          Your in-progress plan was restored from this device.
        </div>
      ) : null}

      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div
          className={cn(
            "order-1 planner-surface-card p-4 sm:p-5",
            mobileSection !== "setup" && "hidden xl:block",
          )}
        >
          <p className="mb-3.5 text-[11px] font-medium text-text-muted">Trade setup</p>
          <div className="space-y-4">
            <Field label="Pair">
              <Select value={pair} onValueChange={setPair}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Select pair" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {TRADE_PLANNER_PAIRS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Direction">
              <div className="flex rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-white/[0.03] p-0.5">
                {(["BUY", "SELL"] as const).map((value) => {
                  const active = direction === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDirection(value)}
                      className={cn(
                        "flex-1 rounded-[calc(var(--radius-sm)-2px)] py-2 text-xs font-medium transition-colors",
                        active
                          ? value === "BUY"
                            ? "border border-profit/30 bg-profit/[0.12] text-profit"
                            : "border border-loss/25 bg-loss/10 text-loss"
                          : "text-text-muted",
                      )}
                    >
                      {value === "BUY" ? "Buy" : "Sell"}
                    </button>
                  )
                })}
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Account size ($)"
                hint={
                  accountSizeReady
                    ? skippedBalanceTrades > 0
                      ? `Prefilled from starting balance + ${skippedBalanceTrades} skipped trade(s) missing result/P&L.`
                      : "Prefilled from current balance (starting + journal P&L)."
                    : "Loading current balance…"
                }
              >
                <Input
                  inputMode="decimal"
                  value={accountSize}
                  onChange={(event) => {
                    setAccountSizeTouched(true)
                    setAccountSize(event.target.value)
                  }}
                  className={plannerInputClass}
                />
              </Field>

              <Field label="Risk %">
                <Input
                  inputMode="decimal"
                  value={riskPercent}
                  onChange={(event) => {
                    setRiskTouched(true)
                    setRiskPercent(event.target.value)
                  }}
                  className={plannerInputClass}
                />
              </Field>

              <Field label="Entry price">
                <Input
                  inputMode="decimal"
                  value={entryPrice}
                  onChange={(event) => setEntryPrice(event.target.value)}
                  className={plannerInputClass}
                />
              </Field>

              <Field label="Stop loss">
                <Input
                  inputMode="decimal"
                  value={stopLoss}
                  onChange={(event) => setStopLoss(event.target.value)}
                  className={plannerInputClass}
                />
              </Field>

              <Field label="Take profit" className="sm:col-span-2">
                <Input
                  inputMode="decimal"
                  value={takeProfit}
                  onChange={(event) => setTakeProfit(event.target.value)}
                  className={plannerInputClass}
                />
              </Field>
            </div>

            <PlanChartUploadPanel
              screenshotUrl={chartScreenshotUrl}
              pointers={displayPointers}
              isUploading={isChartUploading}
              isAnalyzing={isChartAnalyzing}
              onUpload={(file) => void handleChartUpload(file)}
              onRemove={() => {
                setChartScreenshotUrl(null)
                setChartPointers([])
              }}
              disabled={isSaving}
            />

            {consolidatedWarning ? (
              <div className="flex items-start gap-2 rounded-r-[var(--radius-sm)] border border-[var(--warning-border)] border-l-2 border-l-[var(--warning)] bg-[var(--warning-bg)] py-2 pl-2.5 pr-3">
                <AlertTriangle className="mt-0.5 size-3 shrink-0 text-warning-foreground" />
                <p className="text-[11px] leading-relaxed text-warning-muted">{consolidatedWarning}</p>
              </div>
            ) : null}

            <div
              ref={setupActionsRef}
              className="sticky bottom-[calc(60px+env(safe-area-inset-bottom,0px))] z-10 -mx-4 space-y-2 border-t border-[var(--border-subtle)] bg-[var(--surface-page)] p-4 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 xl:static"
            >
              <SuggestedActionStrip plan={plan} />
              {canCoach ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full rounded-[var(--radius-md)] border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] text-[13px] text-text-accent hover:bg-[var(--color-accent-bg)]"
                  onClick={() => void sendPlanToCoach()}
                >
                  <Brain className="mr-2 size-4" />
                  Analyze with Coach
                </Button>
              ) : null}
              <Button
                type="button"
                className="btn-primary h-10 w-full rounded-[var(--radius-md)] text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canSave || isSaving}
                onClick={() => void handleSavePlan()}
              >
                <Save className="mr-2 size-4" />
                {isSaving
                  ? editingPlanId
                    ? "Updating plan..."
                    : "Saving plan..."
                  : editingPlanId
                    ? "Update pre-trade plan"
                    : "Save pre-trade plan"}
              </Button>
            </div>
          </div>
        </div>

        <div className="order-2 flex flex-col gap-4 xl:order-2">
          <PlanResultPanel
            plan={plan}
            canCoach={canCoach}
            onSendToCoach={() => void sendPlanToCoach()}
            className={cn("order-1 xl:order-2", mobileSection !== "result" && "hidden xl:block")}
          />

          <div
            className={cn(
              "order-2 overflow-hidden planner-surface-card p-4 sm:p-5 xl:order-1",
              mobileSection !== "chart" && "hidden xl:block",
            )}
          >
            <TradePlanVisual plan={plan} />
          </div>

          <RecentPlansPanel
            activePlans={activePlans}
            pastPlans={pastPlans}
            pastPlansOpen={pastPlansOpen}
            onPastPlansToggle={() => setPastPlansOpen((open) => !open)}
            selectedPlanId={loadedPlanId}
            editingPlanId={editingPlanId}
            deletingPlanId={deletingPlanId}
            onSelectPlan={loadSavedPlan}
            onEditPlan={editSavedPlan}
            onDeletePlan={(saved) => void deleteSavedPlan(saved)}
            className={cn("order-3", mobileSection !== "plans" && "hidden xl:block")}
          />
        </div>
      </div>
    </div>
  )
}

function PlannerMobileSectionNav({
  activeSection,
  onSectionChange,
  resultSummary,
}: {
  activeSection: PlannerMobileSection
  onSectionChange: (section: PlannerMobileSection) => void
  resultSummary: string | null
}) {
  return (
    <div className="sticky top-0 z-20 -mx-1 space-y-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-page)]/95 p-1 backdrop-blur-md xl:hidden">
      <div className="grid grid-cols-4 gap-1">
        {PLANNER_MOBILE_SECTIONS.map((section) => {
          const active = activeSection === section.id
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(section.id)}
              className={cn(
                "rounded-[calc(var(--radius-sm)-1px)] px-1 py-2 text-[11px] font-medium transition-colors",
                active
                  ? "bg-[var(--color-accent-bg)] text-text-accent"
                  : "text-text-muted hover:bg-white/[0.04] hover:text-text-primary",
              )}
              aria-pressed={active}
            >
              {section.label}
            </button>
          )
        })}
      </div>
      {resultSummary && activeSection !== "result" ? (
        <button
          type="button"
          onClick={() => onSectionChange("result")}
          className="flex w-full items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-input)] px-2.5 py-1.5 text-left"
        >
          <span className="text-[10px] text-text-muted">Plan result</span>
          <span className="text-[11px] font-medium tabular-nums text-text-primary">{resultSummary}</span>
        </button>
      ) : null}
    </div>
  )
}

function Field({
  label,
  children,
  className,
  hint,
}: {
  label: string
  children: ReactNode
  className?: string
  hint?: string
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="mb-1 block text-[10px] text-text-muted">{label}</span>
      {children}
      {hint ? <span className="block text-[10px] leading-relaxed text-text-muted">{hint}</span> : null}
    </label>
  )
}

function getConsolidatedPlanWarning(warnings: TradePlanWarning[]): string | null {
  if (warnings.length === 0) return null

  const ids = new Set(warnings.map((warning) => warning.id))
  const priceFieldIds = ["invalid_entry", "invalid_stop", "invalid_target", "sl_pips_zero", "tp_pips_zero"]
  const missingPriceCount = priceFieldIds.filter((id) => ids.has(id)).length

  if (missingPriceCount >= 2) {
    return "Fill entry, stop loss, and take profit to calculate."
  }

  return warnings[0]?.message ?? null
}

function SuggestedActionStrip({ plan }: { plan: TradePlanCalculation }) {
  const message =
    plan.suggestedAction === "plan_valid"
      ? "Plan looks good — run Coach before entry"
      : plan.suggestedActionLabel

  return (
    <div
      className={cn(
        "mt-3 flex items-start gap-2 rounded-[var(--radius-md)] border px-3 py-2.5",
        plan.suggestedAction === "plan_valid"
          ? "border-profit/20 bg-profit/[0.06] text-profit"
          : plan.suggestedAction === "adjust_plan"
            ? "border-[var(--warning-border)] bg-[var(--warning-bg)] text-warning-foreground"
            : "border-loss/20 bg-loss/[0.06] text-loss",
      )}
    >
      {plan.suggestedAction === "plan_valid" ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      )}
      <p className="text-[12px] leading-relaxed">{message}</p>
    </div>
  )
}

function PlanResultPanel({
  plan,
  canCoach,
  onSendToCoach,
  className,
}: {
  plan: TradePlanCalculation
  canCoach: boolean
  onSendToCoach: () => void
  className?: string
}) {
  return (
    <div className={cn("planner-surface-card p-4 sm:p-5", className)}>
      <p className="mb-3 text-[11px] font-medium text-text-muted">Plan result</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
        <MetricTile label="Risk $" value={`$${plan.riskAmount.toFixed(2)}`} />
        <MetricTile label="SL pips" value={plan.slPips.toFixed(1)} />
        <MetricTile label="TP pips" value={plan.tpPips.toFixed(1)} />
        <MetricTile
          label="R:R"
          value={formatRiskReward(plan.rr)}
          valueClassName={
            plan.rr != null && plan.rr >= 2
              ? "text-profit"
              : plan.rr != null && plan.rr >= 1
                ? "text-warning-foreground"
                : plan.rr != null
                  ? "text-loss"
                  : undefined
          }
        />
        <MetricTile
          label={
            <>
              <span className="text-warning-foreground">Est.</span> lots
            </>
          }
          value={formatLotSize(plan.recommendedLots)}
          hint="USD acct · 100k units"
        />
        <MetricTile
          label="Pip value/lot"
          value={`$${plan.pipValuePerStandardLot.toFixed(2)}`}
          mutedValue
        />
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-3 h-9 w-full rounded-[var(--radius-md)] border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] text-[13px] text-text-accent hover:bg-[var(--color-accent-bg)]"
        disabled={!canCoach}
        onClick={onSendToCoach}
      >
        <Brain className="mr-2 size-4" />
        Analyze with Coach
      </Button>
    </div>
  )
}

function formatSavedPlanInput(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ""
  const rounded = Math.round(value * 100000) / 100000
  return String(rounded)
}

function SavedPlanListButton({
  saved,
  selected,
  editing,
  deleting,
  onSelect,
  onEdit,
  onDelete,
  subdued = false,
}: {
  saved: SavedPlanRow
  selected: boolean
  editing?: boolean
  deleting?: boolean
  onSelect: (saved: SavedPlanRow) => void
  onEdit?: (saved: SavedPlanRow) => void
  onDelete?: (saved: SavedPlanRow) => void
  subdued?: boolean
}) {
  const canEdit = saved.status === "active" && onEdit

  return (
    <div
      className={cn(
        "rounded-[var(--radius-sm)] border transition-colors",
        selected
          ? "border-[var(--color-accent-border)] bg-[var(--color-accent-bg)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-input)] hover:border-[var(--color-accent-border)]/50 hover:bg-white/[0.03]",
        subdued && !selected && "opacity-80",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(saved)}
        className="w-full px-3 py-2.5 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-text-primary">
              {saved.pair} · {saved.direction}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-text-muted">
              {subdued ? `${saved.status} · ` : ""}
              {new Date(saved.created_at).toLocaleString(undefined, {
                month: "numeric",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="shrink-0 text-right text-[11px] tabular-nums">
            <p className="text-text-accent">{formatRiskReward(saved.rr)}</p>
            <p className="mt-0.5 text-text-muted">
              <span className="text-warning-foreground">Est.</span> {formatLotSize(saved.recommendedLots)} lots
            </p>
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-text-muted">
          {editing
            ? "Editing — change Setup fields, then Update"
            : selected
              ? "Opened — chart, pointers, and Analyze below"
              : "Tap to open this plan"}
        </p>
      </button>

      <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] px-2 py-1.5">
        {canEdit ? (
          <button
            type="button"
            onClick={() => onEdit(saved)}
            className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-page)] text-[10px] text-text-secondary hover:bg-white/[0.04] hover:text-text-primary"
          >
            <Pencil className="size-3" />
            Edit
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            disabled={deleting}
            onClick={() => onDelete(saved)}
            className={cn(
              "inline-flex h-7 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[rgb(from_var(--color-loss)_r_g_b_/_0.25)] bg-[var(--surface-page)] text-[10px] text-[var(--color-loss)] hover:bg-[rgb(from_var(--color-loss)_r_g_b_/_0.08)]",
              canEdit ? "flex-1" : "w-full",
            )}
          >
            {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
            Delete
          </button>
        ) : null}
      </div>
    </div>
  )
}

function RecentPlansPanel({
  activePlans,
  pastPlans,
  pastPlansOpen,
  onPastPlansToggle,
  selectedPlanId,
  editingPlanId,
  deletingPlanId,
  onSelectPlan,
  onEditPlan,
  onDeletePlan,
  className,
}: {
  activePlans: SavedPlanRow[]
  pastPlans: SavedPlanRow[]
  pastPlansOpen: boolean
  onPastPlansToggle: () => void
  selectedPlanId: string | null
  editingPlanId: string | null
  deletingPlanId: string | null
  onSelectPlan: (saved: SavedPlanRow) => void
  onEditPlan: (saved: SavedPlanRow) => void
  onDeletePlan: (saved: SavedPlanRow) => void
  className?: string
}) {
  return (
    <div className={cn("planner-surface-card p-4 sm:p-5", className)}>
      <div className="mb-1 flex items-center gap-2">
        <Save className="size-4 text-text-secondary" />
        <p className="text-[11px] font-medium text-text-muted">Recent plans</p>
      </div>
      <p className="mb-3 text-[10px] text-text-muted">
        Tap a plan to view it, or use Edit / Delete on each row.
      </p>
      {activePlans.length === 0 ? (
        <DashboardEmptyState
          icon={Save}
          title="No active plans"
          description="Saved plans stay separate from post-trade journal entries."
          className="min-h-[100px]"
        />
      ) : (
        <div className="max-h-[min(42vh,320px)] space-y-2 overflow-y-auto overscroll-contain pr-0.5">
          {activePlans.slice(0, 6).map((saved) => (
            <SavedPlanListButton
              key={saved.id}
              saved={saved}
              selected={selectedPlanId === saved.id}
              editing={editingPlanId === saved.id}
              deleting={deletingPlanId === saved.id}
              onSelect={onSelectPlan}
              onEdit={onEditPlan}
              onDelete={onDeletePlan}
            />
          ))}
        </div>
      )}

      {pastPlans.length > 0 ? (
        <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
          <button
            type="button"
            onClick={onPastPlansToggle}
            className="flex w-full items-center justify-between text-left text-[11px] text-text-muted hover:text-text-primary"
          >
            <span>Past plans ({pastPlans.length})</span>
            <ChevronDown
              className={cn("size-4 transition-transform", pastPlansOpen ? "rotate-180" : "")}
            />
          </button>
          {pastPlansOpen ? (
            <div className="mt-2 max-h-[min(36vh,260px)] space-y-2 overflow-y-auto overscroll-contain pr-0.5">
              {pastPlans.slice(0, 12).map((saved) => (
                <SavedPlanListButton
                  key={saved.id}
                  saved={saved}
                  selected={selectedPlanId === saved.id}
                  editing={editingPlanId === saved.id}
                  deleting={deletingPlanId === saved.id}
                  onSelect={onSelectPlan}
                  onEdit={onEditPlan}
                  onDelete={onDeletePlan}
                  subdued
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function MetricTile({
  label,
  value,
  hint,
  valueClassName,
  mutedValue = false,
}: {
  label: ReactNode
  value: string
  hint?: string
  valueClassName?: string
  mutedValue?: boolean
}) {
  return (
    <div className="min-h-[72px] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-input)] px-2.5 py-2.5">
      <p className="text-[10px] leading-snug text-text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 break-all text-[15px] font-medium leading-tight tabular-nums sm:text-base",
          mutedValue ? "text-text-muted" : "text-text-primary",
          valueClassName,
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[10px] leading-snug text-text-muted">{hint}</p> : null}
    </div>
  )
}
