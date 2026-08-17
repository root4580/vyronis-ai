"use client"

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import type { createClient } from "@/lib/supabase/client"
import type { useToast } from "@/hooks/use-toast"
import type { useTradingRules } from "@/hooks/use-trading-rules"
import type { TradingAccountRecord } from "@/lib/accounts/types"
import type { HomeDashboardTrade } from "@/hooks/use-home-dashboard-data"
import {
  createInitialTradeForm,
  parseMistakeTags,
  type TradeFormState,
} from "@/lib/trade-form-config"
import {
  formatRiskPercentForForm,
  parseRiskPercentForPersist,
  calculateRiskReward,
  parseOptionalNumber,
} from "@/lib/trade-form-utils"
import { normalizePnL, normalizeTradeResultForDb } from "@/lib/trade-utils"
import {
  evaluateVyronisJournalTrade,
  buildVyronisJournalPersistFields,
  type VyronisJournalEvaluationRecord,
} from "@/lib/strategy/vyronis-journal-bridge"
import { checkCoachReadiness } from "@/lib/strategy-brain/coach-readiness-gate"
import { buildPlannedContextFromPairPlan } from "@/lib/strategy-brain/weekly-watchlist"
import {
  buildTradeActualForDeviation,
  computePlanDiscipline,
  type PlanDisciplineResult,
} from "@/lib/trade-planner/deviation-engine"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"
import { markRitualCoachComplete, markRitualCoachEngaged } from "@/lib/daily-ritual"
import {
  appendPlannedSetupMarker,
  stripPlannedSetupMarker,
  validateTradeFormForMode,
  type TradeJournalMode,
} from "@/lib/trade-journal-mode"
import { preserveRepeatMarkerOnEdit } from "@/lib/trade-quick-log"
import { evaluateTradeRiskGuard, type TradeRiskGuardResult } from "@/lib/trade-risk-guard"
import { buildTradeReflectionPersistFields } from "@/lib/trades/trade-reflection-persist"
import { deleteJournalCsvImports } from "@/lib/journal/api-client"
import {
  deleteCoachSession,
  fetchCoachSession,
  fetchPlannedCoachSessions,
  generateCoachFeedback,
  linkCoachSessionToTrade,
} from "@/lib/trade-coach/api-client"
import { syncTradeLearningMemory } from "@/lib/learning/api-client"
import { fetchMt5ScreenshotAutofill } from "@/lib/journal/api-client"
import { mt5AutofillHasExtractedFields } from "@/lib/journal/mt5-screenshot-vision-engine"
import { tradeFormPatchFromMt5Autofill } from "@/lib/journal/mt5-trade-form-autofill"
import {
  buildTradeFormFromPlannedSession,
} from "@/lib/trade-coach/planned-context"
import type { PlannedCoachSessionItem, PreTradePlannedContext } from "@/lib/trade-coach/types"
import { lockTradingAccountRequest } from "@/lib/accounts/api-client"
import type { PostSaveDisciplineSummary } from "@/components/dashboard/add-trade-modal"
import { DEFAULT_USER_SETTINGS, type UserSettingsForm, type UserSettingsRecord } from "@/lib/user-settings"

type Trade = HomeDashboardTrade

type OpenCoachOptions = {
  sessionId?: string
  plannedContext?: PreTradePlannedContext
}

type UseTradeJournalOptions = {
  supabase: ReturnType<typeof createClient>
  user: { id: string; email?: string } | null | undefined
  activeAccountId: string | null | undefined
  activeAccount: TradingAccountRecord | null | undefined
  trades: Trade[]
  setTrades: Dispatch<SetStateAction<Trade[]>>
  accountTrades: Trade[]
  refetchTrades: (userId?: string) => void | Promise<void>
  loadAccounts: () => void | Promise<void>
  startingBalance: number
  settingsForm: UserSettingsForm
  userSettings: UserSettingsRecord | null
  toast: ReturnType<typeof useToast>["toast"]
  tradingRules: ReturnType<typeof useTradingRules>
  openPreTradeCoach: (options?: {
    sessionId?: string
    plannedContext?: PreTradePlannedContext
    plannerCheckIn?: boolean
  }) => Promise<void>
}

/**
 * Full trade CRUD subsystem — add/edit/delete, screenshot + MT5 autofill,
 * planned pre-trade coach sessions, risk guard, and Vyronis scoring.
 *
 * Extracted out of app/(app)/hq/page.tsx's "journal" tab so both the old
 * page and the new /trade tab share ONE implementation instead of two
 * copies that could drift apart. hq/page.tsx now calls this hook instead
 * of holding this state/logic inline — behavior is unchanged, this is a
 * pure extraction.
 */
export function useTradeJournal({
  supabase,
  user,
  activeAccountId,
  activeAccount,
  trades,
  setTrades,
  accountTrades,
  refetchTrades,
  loadAccounts,
  startingBalance,
  settingsForm,
  userSettings,
  toast,
  tradingRules,
  openPreTradeCoach,
}: UseTradeJournalOptions) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isJournalImportOpen, setIsJournalImportOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [form, setForm] = useState<TradeFormState>(() =>
    createInitialTradeForm({ risk_percent: String(settingsForm.max_risk_per_trade) }),
  )
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null)
  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isMt5Autofilling, setIsMt5Autofilling] = useState(false)
  const [mt5AutofillSignal, setMt5AutofillSignal] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [screenshotViewer, setScreenshotViewer] = useState<{ url: string | null; label: string } | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [coachSessionId, setCoachSessionId] = useState<string | null>(null)
  const [coachFeedbackRefreshKey, setCoachFeedbackRefreshKey] = useState(0)
  const [plannedSessions, setPlannedSessions] = useState<PlannedCoachSessionItem[]>([])
  const [riskGuardOpen, setRiskGuardOpen] = useState(false)
  const [riskGuardResult, setRiskGuardResult] = useState<TradeRiskGuardResult | null>(null)
  const [vyronisResultOpen, setVyronisResultOpen] = useState(false)
  const [lastVyronisEvaluation, setLastVyronisEvaluation] = useState<VyronisJournalEvaluationRecord | null>(null)
  const [lastVyronisPairLabel, setLastVyronisPairLabel] = useState<string>("")
  const [linkedPlan, setLinkedPlan] = useState<MatchableTradePlan | null>(null)
  const [postSaveDiscipline, setPostSaveDiscipline] = useState<PostSaveDisciplineSummary | null>(null)
  const [tradeJournalMode, setTradeJournalMode] = useState<TradeJournalMode>("log")
  const [isLoadingPlannedSessions, setIsLoadingPlannedSessions] = useState(false)
  const [deletingPlannedSessionId, setDeletingPlannedSessionId] = useState<string | null>(null)
  const [convertSessionId, setConvertSessionId] = useState<string | null>(null)
  const plannedListRefreshSessionRef = useRef<string | null>(null)

  const maxRiskPerTrade =
    userSettings?.max_risk_per_trade ?? settingsForm.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade

  const guardTradingAction = useCallback((): boolean => {
    if (tradingRules.canLogTrade) return true
    if (tradingRules.snapshot?.cooldownRequired) {
      tradingRules.setCooldownModalOpen(true)
      return false
    }
    toast({
      title: "Trading blocked",
      description: tradingRules.blockMessage ?? "Weekly trade limit reached.",
      variant: "destructive",
    })
    return false
  }, [tradingRules, toast])

  // ---- Planned (pre-trade coach) sessions ----------------------------------

  async function refreshPlannedSessions(userId?: string, background = false) {
    const targetUserId = userId ?? user?.id
    if (!targetUserId) return

    if (!background) {
      setIsLoadingPlannedSessions(true)
    }

    try {
      const planned = await fetchPlannedCoachSessions(activeAccountId ?? null)
      setPlannedSessions(planned)
    } catch {
      if (!background) {
        setPlannedSessions([])
      }
    } finally {
      if (!background) {
        setIsLoadingPlannedSessions(false)
      }
    }
  }

  useEffect(() => {
    if (!user?.id) {
      setCoachSessionId(null)
      setPlannedSessions([])
      return
    }
    void refreshPlannedSessions(user.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeAccountId])

  const handleCoachSessionChange = useCallback((sessionId: string | null) => {
    setCoachSessionId(sessionId)
    if (!sessionId || plannedListRefreshSessionRef.current === sessionId) return
    plannedListRefreshSessionRef.current = sessionId
    void refreshPlannedSessions(undefined, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCoachCompleted = useCallback(
    (sessionId: string) => {
      if (user?.id) markRitualCoachComplete(user.id)
      void refreshPlannedSessions(undefined, true)
      toast({
        title: "Pre-trade complete",
        description: "Tap Log this trade in the coach or journal to link plan vs outcome.",
      })
      setCoachSessionId(sessionId)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [toast, user?.id],
  )

  async function handleOpenCoach(context?: PreTradePlannedContext, options: OpenCoachOptions = {}) {
    try {
      let plannedContext = context
      if (!options.sessionId) {
        const gate = await checkCoachReadiness(plannedContext?.pair)
        if (!gate.allowed) {
          toast({ title: gate.headline, description: gate.message, variant: "destructive" })
          return
        }
        if (gate.severity === "warning") {
          toast({ title: gate.headline, description: gate.message })
        }
        if (gate.pairPlan && !plannedContext?.pair) {
          plannedContext = buildPlannedContextFromPairPlan(gate.pairPlan)
        }
      }

      await openPreTradeCoach({ sessionId: options.sessionId, plannedContext })
      if (user?.id) markRitualCoachEngaged(user.id)
    } catch (error) {
      toast({
        title: "Could not open coach session",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    }
  }

  async function handleContinuePlannedCoach(sessionId: string) {
    await handleOpenCoach(undefined, { sessionId })
  }

  async function handleConvertPlannedTrade(sessionId: string) {
    try {
      const session = await fetchCoachSession(sessionId)
      setConvertSessionId(sessionId)
      setCoachSessionId(sessionId)
      setEditingTrade(null)
      setTradeJournalMode("log")
      setForm(buildTradeFormFromPlannedSession(session))
      setIsModalOpen(true)
      toast({ title: "Plan loaded", description: "Log the trade result — outcome, P&L, and psychology." })
    } catch (error) {
      toast({
        title: "Could not load planned trade",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    }
  }

  async function handleDeletePlannedSession(sessionId: string) {
    const session = plannedSessions.find((item) => item.id === sessionId)
    const label = session?.pair ? `${session.pair} plan` : "this planned trade"
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return

    setDeletingPlannedSessionId(sessionId)
    try {
      await deleteCoachSession(sessionId)
      setPlannedSessions((current) => current.filter((item) => item.id !== sessionId))
      if (coachSessionId === sessionId) {
        setCoachSessionId(null)
        setConvertSessionId(null)
      }
      if (convertSessionId === sessionId) {
        setConvertSessionId(null)
      }
      void refreshPlannedSessions(undefined, true)
      toast({ title: "Plan deleted", description: "The unfinished coach session was removed." })
    } catch (error) {
      toast({
        title: "Could not delete plan",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setDeletingPlannedSessionId(null)
    }
  }

  async function finalizeCoachForTrade(tradeId: string, linkedSessionId?: string | null) {
    const sessionToLink = linkedSessionId ?? coachSessionId
    try {
      if (sessionToLink) {
        await linkCoachSessionToTrade(sessionToLink, tradeId)
        setCoachSessionId(null)
        setConvertSessionId(null)
      }
      await generateCoachFeedback(tradeId)
      setCoachFeedbackRefreshKey((current) => current + 1)
      void refreshPlannedSessions(undefined, true)
      toast({
        title: "Coach review ready",
        description: "Open the trade in your journal to see plan vs outcome feedback.",
      })
    } catch (error) {
      toast({
        title: "Coach review unavailable",
        description:
          error instanceof Error
            ? error.message
            : "Run supabase/trade-coach-migration.sql to enable AI Trade Coach.",
        variant: "destructive",
      })
    }
  }

  // ---- Screenshot upload + MT5 autofill ------------------------------------

  const ALLOWED_FILE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  function validateFile(file: File): string | null {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return "Invalid file type. Allowed: jpg, jpeg, png, webp"
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File too large. Maximum size is 10MB"
    }
    return null
  }

  async function uploadTradeImage(file: File): Promise<string | null> {
    const validationError = validateFile(file)
    if (validationError) {
      toast({ title: "Invalid file", description: validationError, variant: "destructive" })
      return null
    }

    setIsUploading(true)
    setUploadProgress(0)

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 150)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Upload failed")
      }

      setUploadProgress(100)
      const { url } = await response.json()
      return url as string
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload screenshot",
        variant: "destructive",
      })
      return null
    } finally {
      clearInterval(progressInterval)
      setIsUploading(false)
      setTimeout(() => setUploadProgress(0), 500)
    }
  }

  async function applyMt5ScreenshotAutofill(
    imageUrl: string,
    hints?: { pairHint?: string; directionHint?: string },
  ) {
    setIsMt5Autofilling(true)
    try {
      const autofill = await fetchMt5ScreenshotAutofill({
        imageUrl,
        pairHint: hints?.pairHint,
        directionHint: hints?.directionHint,
      })

      if (!mt5AutofillHasExtractedFields(autofill)) {
        toast({
          title: "Screenshot saved — could not read MT5 fields",
          description: autofill.summary,
          variant: "destructive",
        })
        return
      }

      setForm((prev) => ({
        ...prev,
        screenshot_url: imageUrl,
        ...tradeFormPatchFromMt5Autofill(autofill, prev),
      }))
      setMt5AutofillSignal((current) => current + 1)

      const filled: string[] = []
      if (autofill.pair) filled.push(autofill.pair)
      if (autofill.direction) filled.push(autofill.direction)
      if (autofill.entry_price != null) filled.push("entry")
      if (autofill.stop_loss != null) filled.push("SL")
      if (autofill.take_profit != null) filled.push("TP")
      if (autofill.close_price != null) filled.push("close")
      if (autofill.profit != null || autofill.result) filled.push("P&L")
      if (autofill.trade_date) filled.push("date")
      if (autofill.session) filled.push("session")
      if (autofill.volume_lots != null) filled.push("lots")

      toast({
        title: "MT5 autofill applied",
        description:
          filled.length > 0
            ? `${filled.join(" · ")} — review all fields before saving.`
            : autofill.summary,
      })
    } catch (error) {
      toast({
        title: "MT5 autofill failed",
        description: error instanceof Error ? error.message : "Try again with a clearer screenshot.",
        variant: "destructive",
      })
    } finally {
      setIsMt5Autofilling(false)
    }
  }

  async function handleScreenshotUpload(file: File) {
    const url = await uploadTradeImage(file)
    if (!url) return
    const pairHint = form.pair || undefined
    const directionHint = form.direction || undefined
    setForm((prev) => ({ ...prev, screenshot_url: url }))
    await applyMt5ScreenshotAutofill(url, { pairHint, directionHint })
  }

  async function handleReflectionChartUpload(file: File) {
    const url = await uploadTradeImage(file)
    if (!url) return
    setForm((prev) => ({ ...prev, reflection_chart_url: url }))
    toast({ title: "Reflection chart uploaded", description: "Save the trade to keep this chart on the review." })
  }

  async function handleReflectionChartUploadForTrade(trade: Trade, file: File) {
    const url = await uploadTradeImage(file)
    if (!url) return

    if (!user?.id) {
      toast({ title: "Not authenticated", description: "You must be logged in to save charts.", variant: "destructive" })
      return
    }

    const { error } = await supabase
      .from("trades")
      .update({ reflection_chart_url: url })
      .eq("id", trade.id)
      .eq("user_id", user.id)

    if (error) {
      const needsMigration = /reflection_chart|column .* does not exist/i.test(error.message)
      toast({
        title: needsMigration ? "Database migration needed" : "Could not save chart",
        description: needsMigration
          ? "Run supabase/038-trade-reflection-chart.sql in the Supabase SQL Editor, then try again."
          : error.message,
        variant: "destructive",
      })
      return
    }

    setTrades((prev) => prev.map((row) => (row.id === trade.id ? { ...row, reflection_chart_url: url } : row)))
    setSelectedTrade((prev) => (prev?.id === trade.id ? { ...prev, reflection_chart_url: url } : prev))
    toast({ title: "Reflection chart saved", description: "TradingView chart attached to this trade." })
  }

  async function handleMt5ScreenshotAutofill() {
    const imageUrl = form.screenshot_url?.trim()
    if (!imageUrl) {
      toast({
        title: "Upload a screenshot first",
        description: "Add an MT5 Terminal, History, or Positions screenshot.",
        variant: "destructive",
      })
      return
    }
    await applyMt5ScreenshotAutofill(imageUrl, {
      pairHint: form.pair || undefined,
      directionHint: form.direction || undefined,
    })
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      void handleScreenshotUpload(file)
    }
  }

  // ---- Add / edit / delete trade --------------------------------------------

  function closeModal() {
    setIsModalOpen(false)
    setEditingTrade(null)
    setConvertSessionId(null)
    setTradeJournalMode("log")
    setLinkedPlan(null)
    setPostSaveDiscipline(null)
    setRiskGuardOpen(false)
    setRiskGuardResult(null)
    setForm(createInitialTradeForm({ risk_percent: String(settingsForm.max_risk_per_trade) }))
  }

  const openManualTrade = useCallback(
    (tradeDate?: string) => {
      if (!guardTradingAction()) return
      setSelectedTrade(null)
      setEditingTrade(null)
      setConvertSessionId(null)
      setTradeJournalMode("log")
      setForm(
        createInitialTradeForm({
          ...(tradeDate ? { trade_date: tradeDate } : {}),
          risk_percent: String(settingsForm.max_risk_per_trade),
        }),
      )
      setIsModalOpen(true)
    },
    [guardTradingAction, settingsForm.max_risk_per_trade],
  )

  const openPlanTrade = useCallback(
    (tradeDate?: string) => {
      if (!guardTradingAction()) return
      setSelectedTrade(null)
      setEditingTrade(null)
      setConvertSessionId(null)
      setTradeJournalMode("plan")
      setForm(
        createInitialTradeForm({
          ...(tradeDate ? { trade_date: tradeDate } : {}),
          risk_percent: String(settingsForm.max_risk_per_trade),
        }),
      )
      setIsModalOpen(true)
    },
    [guardTradingAction, settingsForm.max_risk_per_trade],
  )

  const handleAssignStrategy = useCallback(
    async (tradeId: string, strategyName: string) => {
      if (!user) return

      const { error } = await supabase
        .from("trades")
        .update({ strategy_name: strategyName })
        .eq("id", tradeId)
        .eq("user_id", user.id)

      if (error) {
        toast({ title: "Could not assign strategy", description: error.message, variant: "destructive" })
        return
      }

      setTrades((prev) => prev.map((trade) => (trade.id === tradeId ? { ...trade, strategy_name: strategyName } : trade)))
      toast({ title: "Strategy assigned", description: `${strategyName} saved to this trade.` })
    },
    [supabase, toast, user, setTrades],
  )

  function handleEditTrade(trade: Trade) {
    setSelectedTrade(null)
    setEditingTrade(trade)
    setTradeJournalMode("edit")
    setForm({
      pair: trade.pair,
      direction: trade.direction,
      result: trade.result,
      pnl: Math.abs(trade.pnl).toString(),
      emotion: trade.emotion,
      emotion_after: trade.emotion_after || "",
      setup: trade.setup,
      strategy_name: trade.strategy_name || "",
      risk_percent: formatRiskPercentForForm(trade.risk_percent),
      rule_followed: trade.rule_followed !== false,
      trade_date: trade.trade_date || new Date().toISOString().split("T")[0],
      higher_timeframe: trade.higher_timeframe || "",
      entry_timeframe: trade.entry_timeframe || "",
      confirmation_timeframe: trade.confirmation_timeframe || "",
      confirmation_signal: trade.confirmation_signal || "",
      session: trade.session || "",
      screenshot_url: trade.screenshot_url || "",
      reflection_chart_url: trade.reflection_chart_url || "",
      entry_price: trade.entry_price?.toString() || "",
      stop_loss: trade.stop_loss?.toString() || "",
      take_profit: trade.take_profit?.toString() || "",
      lots: trade.lots?.toString() || "",
      hold_minutes: trade.hold_minutes?.toString() || "",
      mistake_tags: parseMistakeTags(trade.mistake_tags),
      trade_notes: stripPlannedSetupMarker(trade.trade_notes || ""),
      thinking_before: trade.thinking_before || "",
      thinking_during: trade.thinking_during || "",
      thinking_after: trade.thinking_after || "",
      biggest_mistake: trade.biggest_mistake || "",
      lesson_learned: trade.lesson_learned || "",
      what_worked: trade.what_worked || "",
      what_didnt_work: trade.what_didnt_work || "",
      weekly_bias: trade.weekly_bias || "",
      daily_bias: trade.daily_bias || "",
      h4_bias: trade.h4_bias || "",
      aoi_type: trade.aoi_type || "",
      confirmation_type: trade.confirmation_type || "",
      entry_quality: trade.entry_quality || "perfect",
    })
    setIsModalOpen(true)
  }

  function handleDeleteClick(trade: Trade) {
    setTradeToDelete(trade)
    setIsDeleteModalOpen(true)
  }

  async function handleClearJournalCsvDay(dateKey: string) {
    if (!user) return
    const dayLabel = new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const confirmed = window.confirm(`Remove all journal CSV trades on ${dayLabel}? Manual entries on this day are kept.`)
    if (!confirmed) return

    try {
      const { deletedCount } = await deleteJournalCsvImports({ tradeDate: dateKey })
      await refetchTrades(user.id)
      toast({
        title: deletedCount > 0 ? "Day cleared" : "Nothing to remove",
        description:
          deletedCount > 0
            ? `Removed ${deletedCount} CSV import${deletedCount === 1 ? "" : "s"} from ${dayLabel}. Re-import trading-journal-clean.csv to fix dates.`
            : `No journal CSV trades found on ${dayLabel}.`,
      })
    } catch (error) {
      toast({
        title: "Could not clear day",
        description: error instanceof Error ? error.message : "Delete failed",
        variant: "destructive",
      })
    }
  }

  async function confirmDeleteTrade() {
    if (!tradeToDelete || !user) return

    setIsDeleting(true)

    const { error } = await supabase.from("trades").delete().eq("id", tradeToDelete.id).eq("user_id", user.id)

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } else {
      toast({ title: "Trade deleted", description: `${tradeToDelete.pair} trade has been removed.` })
      if (selectedTrade?.id === tradeToDelete.id) {
        setSelectedTrade(null)
      }
      void refetchTrades(user.id)
    }

    setIsDeleting(false)
    setIsDeleteModalOpen(false)
    setTradeToDelete(null)
  }

  function handleRiskGuardCancel() {
    setRiskGuardOpen(false)
    setRiskGuardResult(null)
  }

  function handleRiskGuardConfirm() {
    setRiskGuardOpen(false)
    void executeTradeSubmit()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validation = validateTradeFormForMode(form, editingTrade ? "edit" : tradeJournalMode)
    if (!validation.ok) {
      toast({ title: "Missing fields", description: validation.message, variant: "destructive" })
      return
    }

    if (!user) {
      toast({ title: "Not authenticated", description: "You must be logged in to save trades", variant: "destructive" })
      return
    }

    if (!editingTrade && !guardTradingAction()) {
      return
    }

    const guard = evaluateTradeRiskGuard({
      form,
      journalMode: editingTrade ? "edit" : tradeJournalMode,
      settings: settingsForm,
      startingBalance,
      historicalTrades: accountTrades.map((trade) => ({
        id: trade.id,
        risk_percent: trade.risk_percent,
        rule_followed: trade.rule_followed,
        emotion: trade.emotion,
        emotion_after: trade.emotion_after,
        stop_loss: trade.stop_loss,
        trade_date: trade.trade_date,
        created_at: trade.created_at,
        result: trade.result,
        pnl: trade.pnl,
        setup_classification: trade.setup_classification ?? null,
        mistake_tags: trade.mistake_tags,
      })),
      editingTradeId: editingTrade?.id ?? null,
    })

    if (guard.requiresConfirmation) {
      setRiskGuardResult(guard)
      setRiskGuardOpen(true)
      return
    }

    await executeTradeSubmit()
  }

  async function executeTradeSubmit() {
    const activeUser = user
    if (!activeUser) return
    const activeUserId = activeUser.id

    setIsSubmitting(true)

    const computedRiskReward = calculateRiskReward(form)
    const isPlanSave = tradeJournalMode === "plan" && !editingTrade

    const extendedTradeData = {
      entry_price: parseOptionalNumber(form.entry_price),
      stop_loss: parseOptionalNumber(form.stop_loss),
      take_profit: parseOptionalNumber(form.take_profit),
      risk_reward: computedRiskReward,
      emotion_after: form.emotion_after.trim() || null,
      mistake_tags: form.mistake_tags.length > 0 ? form.mistake_tags.join(",") : null,
      trade_notes: editingTrade
        ? preserveRepeatMarkerOnEdit(editingTrade.trade_notes, form.trade_notes.trim())
        : isPlanSave
          ? appendPlannedSetupMarker(form.trade_notes.trim())
          : form.trade_notes.trim() || null,
      ...buildTradeReflectionPersistFields(form),
    }

    const normalizedResult = isPlanSave ? "BREAKEVEN" : normalizeTradeResultForDb(form.result)

    const vyronisEvaluation = evaluateVyronisJournalTrade(form, {
      riskReward: computedRiskReward,
      maxRiskPercent: maxRiskPerTrade,
    })

    const vyronisFields = buildVyronisJournalPersistFields(form, vyronisEvaluation)

    const tradeData = {
      pair: form.pair,
      direction: form.direction,
      result: normalizedResult,
      pnl: isPlanSave ? 0 : normalizePnL(parseFloat(form.pnl), form.result),
      emotion: form.emotion || "Calm",
      setup: form.setup || "A+ Setup",
      strategy_name: form.strategy_name || null,
      risk_percent: parseRiskPercentForPersist(form.risk_percent),
      rule_followed: form.rule_followed,
      user_id: activeUserId,
      account_id: activeAccountId ?? undefined,
      trade_date: form.trade_date || new Date().toISOString().split("T")[0],
      higher_timeframe: form.higher_timeframe || null,
      entry_timeframe: form.entry_timeframe || null,
      confirmation_timeframe: form.confirmation_timeframe || null,
      session: form.session || null,
      screenshot_url: form.screenshot_url || null,
      reflection_chart_url: form.reflection_chart_url || null,
      ...vyronisFields,
      ...extendedTradeData,
    }

    async function persistTrade(payload: typeof tradeData) {
      if (editingTrade) {
        return supabase.from("trades").update(payload).eq("id", editingTrade.id).eq("user_id", activeUserId).select("id").single()
      }
      const { id: _omitId, ...insertPayload } = payload as typeof tradeData & { id?: string | null }
      return supabase.from("trades").insert([insertPayload]).select("id").single()
    }

    let result = await persistTrade(tradeData)
    let error = result.error
    let usedFallbackSave = false
    let reflectionChartSaveSkipped = false

    if (error && /column|schema cache/i.test(error.message)) {
      const {
        entry_price,
        stop_loss,
        take_profit,
        risk_reward,
        emotion_after,
        mistake_tags,
        trade_notes,
        lots,
        hold_minutes,
        thinking_before,
        thinking_during,
        thinking_after,
        biggest_mistake,
        lesson_learned,
        what_worked,
        what_didnt_work,
        setup_score,
        setup_classification,
        setup_score_breakdown,
        setup_coaching_insights,
        weekly_bias,
        daily_bias,
        h4_bias,
        aoi_type,
        confirmation_type,
        entry_quality,
        vyronis_evaluation,
        ...coreTradeData
      } = tradeData
      result = await persistTrade(coreTradeData as typeof tradeData)
      error = result.error
      usedFallbackSave = !error

      if (error && tradeData.reflection_chart_url && /reflection_chart|column .* does not exist/i.test(error.message)) {
        const { reflection_chart_url, ...withoutReflection } = coreTradeData as typeof tradeData & {
          reflection_chart_url?: string | null
        }
        result = await persistTrade(withoutReflection as typeof tradeData)
        error = result.error
        reflectionChartSaveSkipped = !error
        usedFallbackSave = usedFallbackSave || reflectionChartSaveSkipped
      }
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } else {
      const savedTradeId = editingTrade?.id ?? result.data?.id
      const planToLink = linkedPlan
      const savedPairLabel = `${form.pair} ${form.direction}`
      const savedFormSnapshot = {
        pair: form.pair,
        direction: form.direction,
        entry_price: form.entry_price,
        stop_loss: form.stop_loss,
        take_profit: form.take_profit,
        risk_percent: form.risk_percent,
      }
      let linkedPlanDiscipline: PlanDisciplineResult | null = null

      if (savedTradeId && planToLink && !isPlanSave && !editingTrade) {
        try {
          const linkResponse = await fetch(`/api/trade-plans/${planToLink.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "execute", tradeId: savedTradeId }),
          })
          if (linkResponse.ok) {
            linkedPlanDiscipline = computePlanDiscipline(
              planToLink,
              buildTradeActualForDeviation({
                pair: savedFormSnapshot.pair,
                direction: savedFormSnapshot.direction,
                entryPrice: parseOptionalNumber(savedFormSnapshot.entry_price),
                stopLoss: parseOptionalNumber(savedFormSnapshot.stop_loss),
                takeProfit: parseOptionalNumber(savedFormSnapshot.take_profit),
                lots: planToLink.recommendedLots,
                riskPercent: savedFormSnapshot.risk_percent ? parseFloat(savedFormSnapshot.risk_percent) : 1,
                riskReward: computedRiskReward,
                accountSizeForRisk: planToLink.accountSize,
                startingBalance,
              }),
            )
          }
        } catch (linkError) {
          console.error("Plan link error:", linkError)
        }
      }

      if (reflectionChartSaveSkipped) {
        toast({
          title: "Reflection chart not saved",
          description: "Run supabase/038-trade-reflection-chart.sql in Supabase SQL Editor, then re-upload your TradingView chart.",
          variant: "destructive",
        })
      }

      toast({
        title: editingTrade ? "Trade updated" : isPlanSave ? "Setup saved" : "Trade saved",
        description: usedFallbackSave
          ? `${form.pair} saved without Vyronis columns. Run supabase/028-vyronis-journal-scoring.sql in Supabase.`
          : isPlanSave
            ? `${form.pair} plan scored — Vyronis ${vyronisEvaluation.grade}. Edit later to log WIN/LOSS.`
            : `${form.pair} ${form.direction} — Vyronis ${vyronisEvaluation.grade} (${vyronisEvaluation.score}/100).`,
        variant: usedFallbackSave ? "destructive" : "default",
      })
      setForm(createInitialTradeForm({ risk_percent: String(settingsForm.max_risk_per_trade) }))
      setEditingTrade(null)
      setTradeJournalMode("log")
      setLinkedPlan(null)
      setLastVyronisEvaluation(vyronisEvaluation)
      setLastVyronisPairLabel(savedPairLabel)
      if (linkedPlanDiscipline && savedTradeId) {
        setPostSaveDiscipline({ result: linkedPlanDiscipline, tradeDetailHref: `/journal/trade/${savedTradeId}` })
      } else {
        setIsModalOpen(false)
        setPostSaveDiscipline(null)
        setVyronisResultOpen(true)
      }
      void refetchTrades(activeUserId)
      if (savedTradeId && activeAccountId && activeAccount && !activeAccount.starting_balance_locked && !isPlanSave) {
        void lockTradingAccountRequest(activeAccountId).then(() => loadAccounts()).catch(() => undefined)
      }
      if (savedTradeId) {
        void syncTradeLearningMemory(savedTradeId).catch(() => undefined)
        void finalizeCoachForTrade(savedTradeId, convertSessionId ?? coachSessionId)
      }
      if (activeAccountId && !editingTrade) {
        void tradingRules.syncAfterTrade().then(() => loadAccounts())
      }
    }
    setIsSubmitting(false)
    setRiskGuardResult(null)
  }

  return {
    // form + modal state
    form,
    setForm,
    isModalOpen,
    setIsModalOpen,
    editingTrade,
    isSubmitting,
    tradeJournalMode,
    setTradeJournalMode,
    closeModal,
    openManualTrade,
    openPlanTrade,
    handleSubmit,
    handleEditTrade,
    handleAssignStrategy,
    maxRiskPerTrade,
    linkedPlan,
    setLinkedPlan,
    postSaveDiscipline,

    // delete
    tradeToDelete,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    setTradeToDelete,
    isDeleting,
    handleDeleteClick,
    confirmDeleteTrade,

    // risk guard
    riskGuardOpen,
    riskGuardResult,
    handleRiskGuardCancel,
    handleRiskGuardConfirm,

    // vyronis score result
    vyronisResultOpen,
    setVyronisResultOpen,
    lastVyronisEvaluation,
    lastVyronisPairLabel,

    // screenshots / mt5
    isUploading,
    uploadProgress,
    isDragging,
    isMt5Autofilling,
    mt5AutofillSignal,
    screenshotViewer,
    setScreenshotViewer,
    handleScreenshotUpload,
    handleReflectionChartUpload,
    handleReflectionChartUploadForTrade,
    handleMt5ScreenshotAutofill,
    handleDragOver,
    handleDragLeave,
    handleDrop,

    // trade detail
    selectedTrade,
    setSelectedTrade,

    // csv import
    isJournalImportOpen,
    setIsJournalImportOpen,
    handleClearJournalCsvDay,

    // planned coach sessions
    plannedSessions,
    isLoadingPlannedSessions,
    deletingPlannedSessionId,
    coachSessionId,
    setCoachSessionId,
    coachFeedbackRefreshKey,
    handleContinuePlannedCoach,
    handleConvertPlannedTrade,
    handleDeletePlannedSession,
    handleOpenCoach,
    handleCoachSessionChange,
    handleCoachCompleted,

    // trading-action guard (exposed for FAB/dock wiring)
    guardTradingAction,

    // low-level setters/refresh, exposed for page-level effects (account
    // switch reset, deep-link handling) that don't fit a named action above
    setEditingTrade,
    setConvertSessionId,
    refreshPlannedSessions,
  }
}
