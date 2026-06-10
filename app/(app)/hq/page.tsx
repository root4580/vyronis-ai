"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { X, Pencil, Trash2, Brain, FileUp, Plus, ClipboardCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {
  RecentTradesTable,
  CalendarHeatmapPlaceholder,
  AITradeCoachPlaceholder,
  type DashboardTab,
} from "@/components/dashboard/trading-components"
import {
  LazyEquityCurveChart,
  LazyJournalCommandCenter,
  LazyStrategyPerformance,
  LazyWeeklyDebriefPanel,
  LazyWeeklyPerformance,
} from "@/components/dashboard/lazy-dashboard-modules"
import { TabTransition } from "@/components/dashboard/tab-transition"
import { DashboardOverviewSkeleton, TableSkeleton } from "@/components/dashboard/dashboard-skeletons"
import { ScreenshotViewerModal } from "@/components/dashboard/screenshot-viewer-modal"
import { AddTradeModal, type PostSaveDisciplineSummary } from "@/components/dashboard/add-trade-modal"
import { collectStrategyNamesFromTrades } from "@/components/dashboard/strategy-name-select"
import { TradeDetailsModal } from "@/components/dashboard/trade-details-modal"
import { PlannedTradesSection } from "@/components/dashboard/planned-trades-section"
import { JournalImportModal } from "@/components/dashboard/journal-import-modal"
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
  buildEmptyPlannedContext,
  buildPlannedContextFromForm,
  buildTradeFormFromPlannedSession,
} from "@/lib/trade-coach/planned-context"
import {
  formatRiskPercentForForm,
  parseRiskPercentForPersist,
} from "@/lib/trade-form-utils"
import type { PlannedCoachSessionItem, PreTradePlannedContext } from "@/lib/trade-coach/types"
import {
  createInitialTradeForm,
  parseMistakeTags,
  type TradeFormState,
} from "@/lib/trade-form-config"
import { AccountSettingsModal } from "@/components/dashboard/account-settings-modal"
import {
  DEFAULT_USER_SETTINGS,
  getTodayTrades,
  getTradeRiskViolation,
  normalizeUserSettings,
  type UserSettingsForm,
  type UserSettingsRecord,
} from "@/lib/user-settings"
import { filterTradesForAccount } from "@/lib/account-status"
import { lockTradingAccountRequest } from "@/lib/accounts/api-client"
import { useActiveTradingAccount } from "@/hooks/use-active-trading-account"
import { useTradingRules } from "@/hooks/use-trading-rules"
import { TradingRulesBanner } from "@/components/dashboard/trading-rules-banner"
import { CooldownUnlockModal } from "@/components/dashboard/cooldown-unlock-modal"
import { DEFAULT_DASHBOARD_PREFERENCES, mergeDashboardPreferences, parseDashboardPreferences, type DashboardPreferences } from "@/lib/user-preferences"
import { FirstRunBanner } from "@/components/dashboard/first-run-banner"
import { TodaysMissionCard } from "@/components/dashboard/todays-mission-card"
import { FirstRunSetupModal } from "@/components/dashboard/first-run-setup-modal"
import { TradeEntryActionSheet } from "@/components/dashboard/trade-entry-action-sheet"
import { APP_HOME_PATH } from "@/lib/branding"
import {
  buildDashboardHomePath,
  getDashboardHomeHref,
  getDashboardTabHref,
  getTradeReplayHref,
  parseTabSearchParam,
} from "@/lib/dashboard-nav"
import { useIsMobile } from "@/hooks/use-mobile"
import { useIdleReturnPolicy } from "@/hooks/use-idle-return-policy"
import { useTradingAlerts } from "@/hooks/use-trading-alerts"
import {
  DEFAULT_USER_PROFILE,
  loadUserProfile,
  readCachedUserProfile,
  type UserProfileForm,
} from "@/lib/user-profile"
import {
  buildUserProfileCardProps,
} from "@/components/dashboard/user-profile-card"
import { ConnectedDashboardChrome } from "@/components/dashboard/connected-dashboard-chrome"
import { formatPnL, getPnLTextClass, getSignedPnL, normalizePnL, normalizeTradeResultForDb } from "@/lib/trade-utils"
import { calculateRiskReward, parseOptionalNumber } from "@/lib/trade-form-utils"
import { clearLocalAuthSession, redirectToLogin, signOutWithTimeout } from "@/lib/auth-sign-out"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { clearClientSessionData } from "@/lib/client-session"
import { clearLastActiveAt, touchLastActiveAt } from "@/lib/idle-return-policy"
import { journalTradesOrFilter } from "@/lib/analytics/trade-scope"
import {
  readCachedTrades,
  TRADES_LOAD_TIMEOUT_MS,
  writeCachedTrades,
} from "@/lib/dashboard-cache"
import {
  DASHBOARD_LOAD_TIMEOUT_MS,
  logDashboardLoading,
  withTimeout,
} from "@/lib/dashboard-loading-debug"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import {
  evaluateVyronisJournalTrade,
  buildVyronisJournalPersistFields,
  type VyronisJournalEvaluationRecord,
} from "@/lib/strategy/vyronis-journal-bridge"
import type { SetupCoachingInsight, SetupScoreBreakdown } from "@/lib/trade-coach/setup-score-engine"
import type { VyronisScoreBreakdown } from "@/types/strategy"
import { VyronisScoreResultModal } from "@/components/dashboard/vyronis-score-result-modal"
import { PrimaryLeakCardWithSettings } from "@/components/behavior/primary-leak-card"
import { HqDashboard } from "@/components/dashboard/hq-dashboard"
import { checkCoachReadiness } from "@/lib/strategy-brain/coach-readiness-gate"
import { getTradingViewSignalHref } from "@/lib/tradingview/signal-navigation"
import { buildPlannedContextFromSignalItem } from "@/lib/tradingview/planned-context-from-list-item"
import type { TradingViewSignalListItem } from "@/lib/tradingview/types"
import { buildPlannedContextFromPairPlan } from "@/lib/strategy-brain/weekly-watchlist"
import {
  buildPlannedContextFromTradePlannerPrefill,
  clearTradePlannerCoachPrefill,
  readTradePlannerCoachPrefill,
} from "@/lib/trade-planner/coach-prefill"
import {
  buildTradeActualForDeviation,
  computePlanDiscipline,
  type PlanDisciplineResult,
} from "@/lib/trade-planner/deviation-engine"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"
import { CollapsibleDashboardSection } from "@/components/dashboard/collapsible-dashboard-section"
import { markRitualCoachComplete, markRitualCoachEngaged } from "@/lib/daily-ritual"
import {
  appendPlannedSetupMarker,
  stripPlannedSetupMarker,
  validateTradeFormForMode,
  type TradeJournalMode,
} from "@/lib/trade-journal-mode"
import {
  buildRepeatTradeDraft,
  getMostRecentTradeForRepeat,
  preserveRepeatMarkerOnEdit,
} from "@/lib/trade-quick-log"
import { RiskGuardBanner } from "@/components/dashboard/risk-guard-banner"
import { TradeRiskGuardModal } from "@/components/dashboard/trade-risk-guard-modal"
import { AIContextProvider } from "@/providers/ai-context-provider"
import { CommandCenterLauncher } from "@/components/command-center/command-center-launcher"
import { CommandCenterBridge } from "@/components/command-center/command-center-bridge"
import { VyronisCommandCenter } from "@/components/command-center/vyronis-command-center"
import {
  evaluateTradeRiskGuard,
  type TradeRiskGuardResult,
} from "@/lib/trade-risk-guard"
import {
  DASHBOARD_TRADE_SELECT,
  DASHBOARD_TRADE_SELECT_WITHOUT_REFLECTION,
  DASHBOARD_TRADE_SELECT_WITHOUT_TRADE_REFLECTION,
  DASHBOARD_TRADES_LIMIT,
} from "@/lib/trades/dashboard-trade-query"
import { buildTradeReflectionPersistFields } from "@/lib/trades/trade-reflection-persist"

type Trade = {
  id: string
  pair: string
  direction: string
  result: string
  pnl: number
  emotion: string
  setup: string
  strategy_name: string | null
  risk_percent: number | null
  rule_followed: boolean | null
  user_id: string | null
  account_id?: string | null
  trade_date: string | null
  higher_timeframe: string | null
  entry_timeframe: string | null
  confirmation_timeframe: string | null
  confirmation_signal: string | null
  session: string | null
  screenshot_url: string | null
  reflection_chart_url?: string | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
  risk_reward?: number | null
  lots?: number | null
  opened_at?: string | null
  closed_at?: string | null
  hold_minutes?: number | null
  emotion_after?: string | null
  mistake_tags?: string | null
  trade_notes?: string | null
  thinking_before?: string | null
  thinking_during?: string | null
  thinking_after?: string | null
  biggest_mistake?: string | null
  lesson_learned?: string | null
  what_worked?: string | null
  what_didnt_work?: string | null
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
  import_source?: string | null
  plan_id?: string | null
  created_at: string
}

const initialFormState: TradeFormState = createInitialTradeForm()

type Violation = {
  type: "risk" | "rules" | "emotional"
  message: string
}


function getTradeViolations(trade: Trade, maxRiskPerTrade: number): Violation[] {
  const violations: Violation[] = []

  const riskViolation = getTradeRiskViolation(trade.risk_percent, maxRiskPerTrade)
  if (riskViolation) {
    violations.push({ type: "risk", message: riskViolation })
  }
  
  if (trade.rule_followed === false) {
    violations.push({ type: "rules", message: "Rules broken" })
  }
  
  if (trade.result === "LOSS" && (trade.emotion === "Revenge" || trade.emotion === "Impulsive" || trade.emotion === "FOMO")) {
    violations.push({ type: "emotional", message: "Emotional risk" })
  }
  
  return violations
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  )
}

function Home() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [tradeEntrySheetOpen, setTradeEntrySheetOpen] = useState(false)
  const [isJournalImportOpen, setIsJournalImportOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [form, setForm] = useState<TradeFormState>(initialFormState)
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null)
  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [userSettings, setUserSettings] = useState<UserSettingsRecord | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfileForm | null>(null)
  const [settingsForm, setSettingsForm] = useState<UserSettingsForm>(DEFAULT_USER_SETTINGS)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const signingOutRef = useRef(false)
  const profileWarningShownRef = useRef(false)

  useIdleReturnPolicy({
    enabled: Boolean(user) && !isLoggingOut,
  })

  const loadedDashboardUserRef = useRef<string | null>(null)
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
  const [performanceSectionOpen, setPerformanceSectionOpen] = useState(false)
  const [convertSessionId, setConvertSessionId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DashboardTab>("dashboard")
  const [isLoadingTrades, setIsLoadingTrades] = useState(false)
  const [tradesLoadError, setTradesLoadError] = useState<string | null>(null)
  const [dashboardLoadTimedOut, setDashboardLoadTimedOut] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const dashboardLoadTimedOutRef = useRef(false)
  const globalLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tradesFetchSettledRef = useRef(false)
  const plannedListRefreshSessionRef = useRef<string | null>(null)
  const openCommandCenterRef = useRef<() => void>(() => {})
  const openPreTradeCoachRef = useRef<
    (options?: {
      sessionId?: string
      plannedContext?: PreTradePlannedContext
      plannerCheckIn?: boolean
    }) => Promise<void>
  >(async () => {})
  const skipUrlTabSyncRef = useRef(true)
  const dashboardPreferences = parseDashboardPreferences(userSettings?.dashboard_preferences)

  const handleDashboardPreferencesChange = useCallback((preferences: DashboardPreferences) => {
    setUserSettings((current) =>
      current ? { ...current, dashboard_preferences: preferences } : current,
    )
  }, [])

  const {
    accounts: tradingAccounts,
    activeAccount,
    activeAccountId,
    legacyTradeAccountId,
    isLoading: isLoadingAccounts,
    isSaving: isSavingAccounts,
    error: accountsError,
    loadAccounts,
    switchAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    accountSwitcher,
  } = useActiveTradingAccount({
    supabase,
    userId: user?.id,
    dashboardPreferences,
    onPreferencesChange: handleDashboardPreferencesChange,
  })

  const tradingRules = useTradingRules({
    accountId: activeAccountId,
    enabled: Boolean(user?.id),
  })

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

  const accountTrades = useMemo(
    () => filterTradesForAccount(trades, activeAccountId, legacyTradeAccountId),
    [trades, activeAccountId, legacyTradeAccountId],
  )

  const accountContextRefreshSalt = useMemo(() => {
    if (!activeAccountId) return 0
    return activeAccountId.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  }, [activeAccountId])

  const bindOpenCommandCenter = useCallback((open: () => void) => {
    openCommandCenterRef.current = open
  }, [])

  const openDashboardPerformance = useCallback(() => {
    setActiveTab("dashboard")
    router.replace(getDashboardTabHref("dashboard"))
    setPerformanceSectionOpen(true)
    window.setTimeout(() => {
      document
        .getElementById("dashboard-performance")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 120)
  }, [router])
  const [preTradeCoachReady, setPreTradeCoachReady] = useState(false)
  const bindOpenPreTradeCoach = useCallback(
    (
      openPreTrade: (options?: {
        sessionId?: string
        plannedContext?: PreTradePlannedContext
        plannerCheckIn?: boolean
      }) => Promise<void>,
    ) => {
      openPreTradeCoachRef.current = openPreTrade
      setPreTradeCoachReady(true)
    },
    [],
  )

  function clearGlobalLoadTimeout() {
    if (globalLoadTimeoutRef.current) {
      window.clearTimeout(globalLoadTimeoutRef.current)
      globalLoadTimeoutRef.current = null
    }
  }

  function releaseSkeletonGuard(reason: string) {
    if (dashboardLoadTimedOutRef.current) return

    dashboardLoadTimedOutRef.current = true
    setDashboardLoadTimedOut(true)
    setIsLoadingTrades(false)
    setIsLoadingProfile(false)

    logDashboardLoading("releaseSkeletonGuard", {
      reason,
      activeTab,
      tradesCount: trades.length,
      tradesFetchSettled: tradesFetchSettledRef.current,
    })
  }

  function markDashboardDataReady(reason: string) {
    clearGlobalLoadTimeout()
    tradesFetchSettledRef.current = true
    setIsLoadingTrades(false)
    setIsLoadingProfile(false)
    setTradesLoadError(null)
    setLastSyncedAt(new Date())

    logDashboardLoading("markDashboardDataReady", {
      reason,
      activeTab,
      tradesCount: trades.length,
    })
  }

  useEffect(() => {
    setIsLoadingTrades(true)
    setIsLoadingProfile(true)

    logDashboardLoading("mount", { awaitingAuth: true })

    const timeoutId = window.setTimeout(() => {
      releaseSkeletonGuard("mount-skeleton-timeout")
    }, TRADES_LOAD_TIMEOUT_MS)

    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    logDashboardLoading("loading-state-changed", {
      isLoadingTrades,
      isLoadingProfile,
      dashboardLoadTimedOut,
      showTradesSkeleton: isLoadingTrades && !dashboardLoadTimedOut,
      showProfileSkeleton: isLoadingProfile && !dashboardLoadTimedOut,
      userId: user?.id ?? null,
      activeTab,
      tradesCount: trades.length,
      tradesLoadError,
    })
  }, [
    isLoadingTrades,
    isLoadingProfile,
    dashboardLoadTimedOut,
    user?.id,
    activeTab,
    trades.length,
    tradesLoadError,
  ])
  
  const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  
  function validateFile(file: File): string | null {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return 'Invalid file type. Allowed: jpg, jpeg, png, webp'
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum size is 10MB'
    }
    return null
  }
  
  async function uploadTradeImage(file: File): Promise<string | null> {
    const validationError = validateFile(file)
    if (validationError) {
      toast({
        title: "Invalid file",
        description: validationError,
        variant: "destructive",
      })
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
    toast({
      title: "Reflection chart uploaded",
      description: "Save the trade to keep this chart on the review.",
    })
  }

  async function handleReflectionChartUploadForTrade(trade: Trade, file: File) {
    const url = await uploadTradeImage(file)
    if (!url) return

    if (!user?.id) {
      toast({
        title: "Not authenticated",
        description: "You must be logged in to save charts.",
        variant: "destructive",
      })
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

    setTrades((prev) =>
      prev.map((row) => (row.id === trade.id ? { ...row, reflection_chart_url: url } : row)),
    )
    setSelectedTrade((prev) =>
      prev?.id === trade.id ? { ...prev, reflection_chart_url: url } : prev,
    )
    toast({
      title: "Reflection chart saved",
      description: "TradingView chart attached to this trade.",
    })
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
      handleScreenshotUpload(file)
    }
  }
  
  useEffect(() => {
    let cancelled = false

    async function ensureUserSettings(userId: string) {
      await supabase.from("user_settings").upsert(
        {
          user_id: userId,
          ...DEFAULT_USER_SETTINGS,
          dashboard_preferences: DEFAULT_DASHBOARD_PREFERENCES,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id", ignoreDuplicates: true },
      )
    }

    async function ensureUserProfile(userId: string) {
      await supabase.from("user_profiles").upsert(
        {
          user_id: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id", ignoreDuplicates: true },
      )
    }

    async function loadDashboardData(
      userId: string,
      metadata?: Record<string, unknown> | null,
      options?: { silent?: boolean },
    ) {
      logDashboardLoading("loadDashboardData:start", { userId, silent: options?.silent ?? false })

      const results = await Promise.allSettled([
        fetchTrades(userId, options),
        fetchUserSettings(userId),
        fetchUserProfile(userId, metadata, options),
      ])

      logDashboardLoading("loadDashboardData:complete", {
        userId,
        trades: results[0].status,
        settings: results[1].status,
        profile: results[2].status,
        tradesFetchSettled: tradesFetchSettledRef.current,
      })
    }

    async function bootstrapFromSession(sessionUser: {
      id: string
      email?: string
      user_metadata?: Record<string, unknown>
    }) {
      if (cancelled || loadedDashboardUserRef.current === sessionUser.id) return

      loadedDashboardUserRef.current = sessionUser.id
      setUser({ id: sessionUser.id, email: sessionUser.email })
      touchLastActiveAt()

      try {
        const cachedTrades = readCachedTrades<Trade>(sessionUser.id)
        const cachedProfile = readCachedUserProfile(sessionUser.id)
        if (cachedTrades.length > 0) {
          setTrades(cachedTrades)
        }
        if (cachedProfile) {
          setUserProfile(cachedProfile)
        }

        await loadDashboardData(sessionUser.id, sessionUser.user_metadata, {
          silent: cachedTrades.length > 0 || cachedProfile !== null,
        })
      } catch (error) {
        loadedDashboardUserRef.current = null
        throw error
      }
    }

    void supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user: { id: string; email?: string | null } } | null } }) => {
      if (cancelled || !session?.user) return
      logDashboardLoading("bootstrap:getSession", { userId: session.user.id })
      void bootstrapFromSession({
        id: session.user.id,
        email: session.user.email ?? undefined,
      })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, session: { user: { id: string; email?: string | null } } | null) => {
      if (cancelled) return

      logDashboardLoading("auth-state-change", {
        event,
        userId: session?.user?.id ?? null,
      })

      if (event === "SIGNED_OUT") {
        const previousUserId = loadedDashboardUserRef.current
        loadedDashboardUserRef.current = null
        tradesFetchSettledRef.current = false
        clearClientSessionData(previousUserId)
        setUser(null)
        setTrades([])
        setUserSettings(null)
        setUserProfile(null)
        setTradesLoadError(null)
        setIsLoadingTrades(false)
        setIsLoadingProfile(false)
        dashboardLoadTimedOutRef.current = false
        setDashboardLoadTimedOut(false)

        if (!signingOutRef.current) {
          redirectToLogin()
        }
        return
      }

      if (!session?.user) {
        return
      }

      setUser({ id: session.user.id, email: session.user.email ?? undefined })

      if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN") {
        return
      }

      if (
        loadedDashboardUserRef.current &&
        loadedDashboardUserRef.current !== session.user.id
      ) {
        clearClientSessionData(loadedDashboardUserRef.current)
        setTrades([])
        setUserProfile(null)
        setUserSettings(null)
        tradesFetchSettledRef.current = false
      }

      if (loadedDashboardUserRef.current === session.user.id) {
        logDashboardLoading("auth-state-change:skip-already-loaded", {
          userId: session.user.id,
          event,
        })
        return
      }

      void (async () => {
        try {
          if (event === "SIGNED_IN") {
            await ensureUserSettings(session.user.id)
            await ensureUserProfile(session.user.id)
          }

          if (cancelled) return

          await bootstrapFromSession({
            id: session.user.id,
            email: session.user.email ?? undefined,
          })
        } catch (error) {
          logDashboardLoading("auth-state-change:load-error", {
            event,
            message: error instanceof Error ? error.message : String(error),
          })
          if (!cancelled) {
            setTradesLoadError(
              "Could not load dashboard data right now. Try refreshing the page.",
            )
            releaseSkeletonGuard("auth-load-error")
          }
        }
      })()
    })

    return () => {
      cancelled = true
      loadedDashboardUserRef.current = null
      tradesFetchSettledRef.current = false
      subscription.unsubscribe()
    }
  }, [router, supabase])

  async function fetchTrades(
    userId?: string,
    options?: { silent?: boolean },
  ) {
    const uid = userId || user?.id
    if (!uid) {
      logDashboardLoading("fetchTrades:skip-no-user")
      setIsLoadingTrades(false)
      return
    }

    const cachedTrades = readCachedTrades<Trade>(uid)
    const hasCachedTrades = cachedTrades.length > 0

    if (hasCachedTrades && trades.length === 0) {
      setTrades(cachedTrades)
    }

    logDashboardLoading("fetchTrades:start", {
      userId: uid,
      silent: options?.silent ?? false,
      hasCachedTrades,
      dashboardLoadTimedOut: dashboardLoadTimedOutRef.current,
    })

    if (
      !options?.silent &&
      !hasCachedTrades &&
      trades.length === 0 &&
      !dashboardLoadTimedOutRef.current
    ) {
      setIsLoadingTrades(true)
    }

    if (!options?.silent) {
      setTradesLoadError(null)
    }

    try {
      let query = supabase
        .from("trades")
        .select(DASHBOARD_TRADE_SELECT)
        .eq("user_id", uid)
        .or(journalTradesOrFilter())
        .order("created_at", { ascending: false })
        .limit(DASHBOARD_TRADES_LIMIT)

      let { data, error } = await withTimeout(
        query as Promise<{
          data: Trade[] | null
          error: { message: string; code?: string } | null
        }>,
        15000,
        "trades.select",
      )

      if (error && /import_source|reflection_chart|thinking_before|hold_minutes|column .* does not exist/i.test(error.message)) {
        const fallbackSelect = error.message.includes("reflection_chart")
          ? DASHBOARD_TRADE_SELECT_WITHOUT_REFLECTION
          : /thinking_before|hold_minutes|what_worked/i.test(error.message)
            ? DASHBOARD_TRADE_SELECT_WITHOUT_TRADE_REFLECTION
            : DASHBOARD_TRADE_SELECT.replace(", account_id", "")
        const fallback = await withTimeout(
          supabase
            .from("trades")
            .select(fallbackSelect)
            .eq("user_id", uid)
            .or(journalTradesOrFilter())
            .order("created_at", { ascending: false })
            .limit(DASHBOARD_TRADES_LIMIT) as Promise<{
            data: Trade[] | null
            error: { message: string; code?: string } | null
          }>,
          15000,
          "trades.select.fallback",
        )
        data = fallback.data
        error = fallback.error
      }

      if (error) {
        console.log(error)
        logDashboardLoading("fetchTrades:error", {
          userId: uid,
          message: error.message,
          code: error.code,
        })
        if (!options?.silent) {
          setTradesLoadError(
            hasCachedTrades
              ? "Couldn't refresh trades. Showing your last saved session."
              : "Couldn't load trades right now. Try refreshing the page.",
          )
        }
        return
      }

      const nextTrades = data || []
      setTrades(nextTrades)
      writeCachedTrades(uid, nextTrades)
      tradesFetchSettledRef.current = true

      if (!options?.silent) {
        markDashboardDataReady("fetchTrades:success")
      } else {
        setIsLoadingTrades(false)
      }

      logDashboardLoading("fetchTrades:success", {
        userId: uid,
        count: nextTrades.length,
      })
    } catch (error) {
      console.log(error)
      logDashboardLoading("fetchTrades:exception", {
        userId: uid,
        message: error instanceof Error ? error.message : String(error),
      })
      if (!options?.silent) {
        setTradesLoadError(
          hasCachedTrades
            ? "Couldn't refresh trades. Showing your last loaded data."
            : "Couldn't load trades right now. Try refreshing the page.",
        )
      }
    } finally {
      setIsLoadingTrades(false)
    }
  }

  function persistActiveTab(tab: DashboardTab) {
    if (!user) return

    void supabase
      .from("user_settings")
      .update({
        dashboard_preferences: mergeDashboardPreferences(userSettings?.dashboard_preferences, {
          activeTab: tab,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
  }

  useEffect(() => {
    setActiveTab("dashboard")
    if (pathname === "/" && searchParams.get("tab")) {
      router.replace(buildDashboardHomePath(searchParams))
    }
    skipUrlTabSyncRef.current = false
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- full refresh always starts on dashboard

  useEffect(() => {
    if (skipUrlTabSyncRef.current) return

    const tabFromUrl = parseTabSearchParam(searchParams.get("tab"))
    if (!tabFromUrl) {
      setActiveTab("dashboard")
      return
    }

    setActiveTab(tabFromUrl)
    if (user?.id) {
      persistActiveTab(tabFromUrl)
    }
  }, [searchParams, user?.id])

  useEffect(() => {
    setSelectedTrade(null)
    setEditingTrade(null)
  }, [activeAccountId])

  useEffect(() => {
    const tradeId = searchParams.get("trade")
    if (!tradeId || accountTrades.length === 0) return

    const trade = accountTrades.find((row) => String(row.id) === String(tradeId))
    if (trade) {
      setSelectedTrade(trade)
    }
  }, [searchParams, accountTrades])

  useEffect(() => {
    if (searchParams.get("action") !== "new-trade") return

    setEditingTrade(null)
    setConvertSessionId(null)
    setTradeJournalMode("log")
    setForm(
      createInitialTradeForm({
        risk_percent: String(settingsForm.max_risk_per_trade),
      }),
    )
    setIsModalOpen(true)

    const tab = parseTabSearchParam(searchParams.get("tab")) ?? activeTab
    const params = new URLSearchParams()
    if (tab && tab !== "dashboard") {
      params.set("tab", tab)
    }
    const next = params.toString() ? `${APP_HOME_PATH}?${params.toString()}` : APP_HOME_PATH
    router.replace(next)
  }, [activeTab, router, searchParams, settingsForm.max_risk_per_trade])

  useEffect(() => {
    const coachPair = searchParams.get("coachPair")?.trim()
    if (!coachPair || !user?.id || !preTradeCoachReady) return

    void (async () => {
      const gate = await checkCoachReadiness(coachPair)
      if (!gate.allowed) {
        toast({
          title: gate.headline,
          description: gate.message,
          variant: "destructive",
        })
        router.replace("/war-room")
        return
      }
      if (gate.severity === "warning") {
        toast({ title: gate.headline, description: gate.message })
      }
      const plannedContext = gate.pairPlan
        ? buildPlannedContextFromPairPlan(gate.pairPlan)
        : { ...buildEmptyPlannedContext(), pair: coachPair }
      await openPreTradeCoachRef.current?.({ plannedContext })
      markRitualCoachEngaged(user.id)
      router.replace(buildDashboardHomePath(searchParams))
    })()
  }, [searchParams, user?.id, toast, router, preTradeCoachReady])

  useEffect(() => {
    if (searchParams.get("openCoach") !== "1" || !user?.id || !preTradeCoachReady) return

    void (async () => {
      const gate = await checkCoachReadiness()
      if (!gate.allowed) {
        toast({
          title: gate.headline,
          description: gate.message,
          variant: "destructive",
        })
        router.replace("/war-room")
        return
      }
      if (gate.severity === "warning") {
        toast({ title: gate.headline, description: gate.message })
      }
      const plannedContext = gate.pairPlan
        ? buildPlannedContextFromPairPlan(gate.pairPlan)
        : buildEmptyPlannedContext()
      await openPreTradeCoachRef.current?.({ plannedContext })
      markRitualCoachEngaged(user.id)
      router.replace(buildDashboardHomePath(searchParams))
    })()
  }, [searchParams, user?.id, toast, router, preTradeCoachReady])

  useEffect(() => {
    const coachSession = searchParams.get("coach")?.trim()
    if (!coachSession || !user?.id || !preTradeCoachReady) return

    void openPreTradeCoachRef.current?.({ sessionId: coachSession })
    markRitualCoachEngaged(user.id)
    setActiveTab("dashboard")
    const params = new URLSearchParams(searchParams.toString())
    params.delete("coach")
    params.delete("tab")
    const next = params.toString() ? `${APP_HOME_PATH}?${params.toString()}` : getDashboardHomeHref()
    router.replace(next)
  }, [searchParams, user?.id, router, preTradeCoachReady])

  useEffect(() => {
    if (searchParams.get("coachPlan") !== "1" || !user?.id || !preTradeCoachReady) return

    void (async () => {
      const prefill = readTradePlannerCoachPrefill()

      if (!prefill) {
        toast({
          title: "Plan data missing",
          description: "Run Coach check-in from Trade Planner again.",
          variant: "destructive",
        })
        router.replace(getDashboardHomeHref())
        return
      }

      const plannedContext = buildPlannedContextFromTradePlannerPrefill(
        prefill,
        settingsForm.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade,
      )
      await openPreTradeCoachRef.current({ plannedContext, plannerCheckIn: true })
      clearTradePlannerCoachPrefill()
      markRitualCoachEngaged(user.id)
      router.replace(getDashboardHomeHref())
    })()
  }, [searchParams, user?.id, preTradeCoachReady, settingsForm.max_risk_per_trade, toast, router])

  useEffect(() => {
    if (activeTab !== "analytics") return
    router.replace("/analytics")
  }, [activeTab, router])

  async function fetchUserSettings(userId: string) {
    logDashboardLoading("fetchUserSettings:start", { userId })

    try {
      const { data, error } = await withTimeout(
        supabase
          .from("user_settings")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle() as Promise<{
          data: UserSettingsRecord | null
          error: { message: string; code?: string } | null
        }>,
        DASHBOARD_LOAD_TIMEOUT_MS,
        "user_settings.select",
      )

      if (error && error.code !== "PGRST116") {
        console.log(error)
        logDashboardLoading("fetchUserSettings:error", { message: error.message })
      }

      if (data) {
        setUserSettings(data)
        setSettingsForm(normalizeUserSettings(data))

        logDashboardLoading("fetchUserSettings:success", { userId })
        return
      }

      await supabase.from("user_settings").upsert(
        {
          user_id: userId,
          ...DEFAULT_USER_SETTINGS,
          dashboard_preferences: DEFAULT_DASHBOARD_PREFERENCES,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id", ignoreDuplicates: true },
      )

      const { data: createdSettings } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()

      if (createdSettings) {
        setUserSettings(createdSettings)
        setSettingsForm(normalizeUserSettings(createdSettings))

        setActiveTab("dashboard")

        logDashboardLoading("fetchUserSettings:created-defaults", { userId })
        return
      }

      setSettingsForm(DEFAULT_USER_SETTINGS)
      setActiveTab(DEFAULT_DASHBOARD_PREFERENCES.activeTab)
      logDashboardLoading("fetchUserSettings:fallback-defaults", { userId })
    } catch (error) {
      logDashboardLoading("fetchUserSettings:timeout-or-failure", {
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async function fetchUserProfile(
    userId: string,
    metadata?: Record<string, unknown> | null,
    options?: { silent?: boolean },
  ) {
    logDashboardLoading("fetchUserProfile:start", {
      userId,
      silent: options?.silent ?? false,
    })

    const cached = readCachedUserProfile(userId)
    if (cached) {
      setUserProfile(cached)
    }

    if (
      !options?.silent &&
      !cached &&
      !dashboardLoadTimedOutRef.current
    ) {
      setIsLoadingProfile(true)
    }

    try {
      const result = await withTimeout(
        loadUserProfile(supabase, userId, metadata),
        DASHBOARD_LOAD_TIMEOUT_MS,
        "user_profiles.load",
      )

      setUserProfile(result.profile)
      logDashboardLoading("fetchUserProfile:success", { userId })

      if (result.missingTable && !profileWarningShownRef.current) {
        profileWarningShownRef.current = true
        toast({
          title: "Profile table missing",
          description: "Run supabase/user-profiles-migration.sql in Supabase, then save your name at /profile.",
          variant: "destructive",
        })
      }
    } catch (error) {
      logDashboardLoading("fetchUserProfile:timeout-or-failure", {
        message: error instanceof Error ? error.message : String(error),
      })
      if (cached) {
        setUserProfile(cached)
      }
    } finally {
      setIsLoadingProfile(false)
    }
  }

  useEffect(() => {
    if (!user?.id || pathname !== "/") return

    const mountedAt = Date.now()

    function refreshProfile() {
      if (Date.now() - mountedAt < 1500) return

      void supabase.auth.getUser().then(({ data: { user: authUser } }: { data: { user: { id: string; user_metadata?: Record<string, unknown> } | null } }) => {
        if (!authUser) return
        void fetchUserProfile(authUser.id, authUser.user_metadata, { silent: true })
      })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshProfile()
      }
    }

    window.addEventListener("focus", refreshProfile)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", refreshProfile)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [user?.id, pathname, supabase])

  useEffect(() => {
    if (!user?.id) {
      setCoachSessionId(null)
      setPlannedSessions([])
      return
    }

    void refreshPlannedSessions(user.id)
  }, [user?.id, activeAccountId])

  type OpenCoachOptions = {
    sessionId?: string
    plannedContext?: PreTradePlannedContext
  }

  async function handleOpenCoach(context?: PreTradePlannedContext, options: OpenCoachOptions = {}) {
    try {
      let plannedContext = context
      if (!options.sessionId) {
        const gate = await checkCoachReadiness(plannedContext?.pair)
        if (!gate.allowed) {
          toast({
            title: gate.headline,
            description: gate.message,
            variant: "destructive",
          })
          return
        }
        if (gate.severity === "warning") {
          toast({ title: gate.headline, description: gate.message })
        }
        if (gate.pairPlan && !plannedContext?.pair) {
          plannedContext = buildPlannedContextFromPairPlan(gate.pairPlan)
        }
      }

      await openPreTradeCoachRef.current({
        sessionId: options.sessionId,
        plannedContext,
      })
      if (user?.id) {
        markRitualCoachEngaged(user.id)
      }
    } catch (error) {
      toast({
        title: "Could not open coach session",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    }
  }

  async function refreshPlannedSessions(userId?: string, background = false) {
    const targetUserId = userId ?? user?.id
    if (!targetUserId) return

    if (!background) {
      setIsLoadingPlannedSessions(true)
    }

    try {
      const planned = await fetchPlannedCoachSessions(activeAccountId)
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

  const handleCoachSessionChangeFromHq = useCallback(
    (sessionId: string | null) => {
      setCoachSessionId(sessionId)
      if (!sessionId || plannedListRefreshSessionRef.current === sessionId) return
      plannedListRefreshSessionRef.current = sessionId
      void refreshPlannedSessions(undefined, true)
    },
    [user?.id],
  )

  const handleCoachCompletedFromHq = useCallback(
    (sessionId: string) => {
      if (user?.id) markRitualCoachComplete(user.id)
      void refreshPlannedSessions(undefined, true)
      toast({
        title: "Pre-trade complete",
        description: "Tap Log this trade in the coach or journal to link plan vs outcome.",
      })
      setCoachSessionId(sessionId)
    },
    [toast, user?.id],
  )

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
      toast({
        title: "Plan loaded",
        description: "Log the trade result — outcome, P&L, and psychology.",
      })
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
      toast({
        title: "Plan deleted",
        description: "The unfinished coach session was removed.",
      })
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

  async function completeFirstRunSetup(
    updates: Partial<UserSettingsForm>,
    options?: { openWarRoom?: boolean },
  ) {
    if (!user) return

    setIsSavingSettings(true)
    const nextForm = { ...settingsForm, ...updates }

    const settingsData = {
      user_id: user.id,
      starting_balance: nextForm.starting_balance,
      daily_drawdown_limit: nextForm.daily_drawdown_limit,
      max_risk_per_trade: nextForm.max_risk_per_trade,
      max_trades_per_day: nextForm.max_trades_per_day,
      prop_firm_size: nextForm.prop_firm_size,
      profit_target: nextForm.profit_target,
      preferred_session: nextForm.preferred_session,
      dashboard_preferences: mergeDashboardPreferences(userSettings?.dashboard_preferences, {
        activeTab,
        onboardingCompleted: true,
      }),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("user_settings")
      .upsert(settingsData, { onConflict: "user_id" })
      .select("*")
      .single()

    setIsSavingSettings(false)

    if (error) {
      toast({
        title: "Could not save setup",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    if (data) {
      setUserSettings(data)
      setSettingsForm(normalizeUserSettings(data))
    } else {
      setSettingsForm(nextForm)
    }

    toast({
      title: "Setup complete",
      description: options?.openWarRoom
        ? "War Room is ready — plan your first weekly setup."
        : "Set up your first War Room when you're ready — your weekly plan unlocks analytics.",
      action: options?.openWarRoom ? undefined : (
        <ToastAction altText="Open War Room" onClick={() => router.push("/war-room")}>
          Open War Room
        </ToastAction>
      ),
    })

    if (options?.openWarRoom) {
      router.push("/war-room")
    }
  }

  async function saveUserSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    setIsSavingSettings(true)

    const settingsData = {
      user_id: user.id,
      starting_balance: settingsForm.starting_balance,
      daily_drawdown_limit: settingsForm.daily_drawdown_limit,
      max_risk_per_trade: settingsForm.max_risk_per_trade,
      max_trades_per_day: settingsForm.max_trades_per_day,
      prop_firm_size: settingsForm.prop_firm_size,
      profit_target: settingsForm.profit_target,
      preferred_session: settingsForm.preferred_session,
      dashboard_preferences: mergeDashboardPreferences(userSettings?.dashboard_preferences, { activeTab }),
      updated_at: new Date().toISOString(),
    }

    async function persistSettings(payload: typeof settingsData) {
      return supabase
        .from("user_settings")
        .upsert(payload, { onConflict: "user_id" })
        .select("*")
        .single()
    }

    let result = await persistSettings(settingsData)
    let error = result.error
    let savedSettings = result.data
    let usedFallbackSave = false

    if (error && /column|schema cache/i.test(error.message)) {
      const { max_trades_per_day, dashboard_preferences, ...coreSettingsData } = settingsData
      result = await persistSettings(coreSettingsData as typeof settingsData)
      error = result.error
      savedSettings = result.data
      usedFallbackSave = !error
    }

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } else {
      if (savedSettings) {
        setUserSettings(savedSettings)
        setSettingsForm(normalizeUserSettings(savedSettings))
      }
      toast({
        title: "Settings saved",
        description: usedFallbackSave
          ? "Settings saved, but max trades per day needs supabase/user-settings-migration.sql."
          : "Your account settings have been updated.",
        variant: usedFallbackSave ? "destructive" : "default",
      })
      fetchUserSettings(user.id)
      setIsSettingsOpen(false)
    }

    setIsSavingSettings(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validation = validateTradeFormForMode(form, editingTrade ? "edit" : tradeJournalMode)
    if (!validation.ok) {
      toast({
        title: "Missing fields",
        description: validation.message,
        variant: "destructive",
      })
      return
    }

    if (!user) {
      toast({
        title: "Not authenticated",
        description: "You must be logged in to save trades",
        variant: "destructive",
      })
      return
    }

    if (!editingTrade && !guardTradingAction()) {
      return
    }

    const resolvedSettings = normalizeUserSettings(userSettings ?? settingsForm)
    const guard = evaluateTradeRiskGuard({
      form,
      journalMode: editingTrade ? "edit" : tradeJournalMode,
      settings: resolvedSettings,
      startingBalance:
        activeAccount?.starting_balance ??
        userSettings?.starting_balance ??
        settingsForm.starting_balance ??
        DEFAULT_USER_SETTINGS.starting_balance,
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

  function handleRiskGuardCancel() {
    setRiskGuardOpen(false)
    setRiskGuardResult(null)
  }

  function handleRiskGuardConfirm() {
    setRiskGuardOpen(false)
    void executeTradeSubmit()
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

    const normalizedResult = isPlanSave
      ? "BREAKEVEN"
      : normalizeTradeResultForDb(form.result)

    const maxRiskPerTrade =
      userSettings?.max_risk_per_trade ?? settingsForm.max_risk_per_trade ?? 1

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
        return supabase
          .from("trades")
          .update(payload)
          .eq("id", editingTrade.id)
          .eq("user_id", activeUserId)
          .select("id")
          .single()
      }
      // Never send id on insert — DB DEFAULT gen_random_uuid() assigns the PK.
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

      if (
        error &&
        tradeData.reflection_chart_url &&
        /reflection_chart|column .* does not exist/i.test(error.message)
      ) {
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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
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
                riskPercent: savedFormSnapshot.risk_percent
                  ? parseFloat(savedFormSnapshot.risk_percent)
                  : 1,
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
          description:
            "Run supabase/038-trade-reflection-chart.sql in Supabase SQL Editor, then re-upload your TradingView chart.",
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
      setForm(
        createInitialTradeForm({
          risk_percent: String(settingsForm.max_risk_per_trade),
        }),
      )
      setEditingTrade(null)
      setTradeJournalMode("log")
      setLinkedPlan(null)
      setLastVyronisEvaluation(vyronisEvaluation)
      setLastVyronisPairLabel(savedPairLabel)
      if (linkedPlanDiscipline && savedTradeId) {
        setPostSaveDiscipline({
          result: linkedPlanDiscipline,
          tradeDetailHref: `/journal/trade/${savedTradeId}`,
        })
      } else {
        setIsModalOpen(false)
        setPostSaveDiscipline(null)
        setVyronisResultOpen(true)
      }
      fetchTrades(activeUserId)
      if (savedTradeId && activeAccountId && activeAccount && !activeAccount.starting_balance_locked && !isPlanSave) {
        void lockTradingAccountRequest(activeAccountId)
          .then(() => loadAccounts())
          .catch(() => undefined)
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

  const openManualTrade = useCallback((tradeDate?: string) => {
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
  }, [guardTradingAction, settingsForm.max_risk_per_trade])

  const openPlanTrade = useCallback((tradeDate?: string) => {
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
  }, [guardTradingAction, settingsForm.max_risk_per_trade])

  const openTradeEntrySheet = useCallback(() => {
    setTradeEntrySheetOpen(true)
  }, [])

  const handleFabClick = useCallback(() => {
    if (!guardTradingAction()) return
    if (isMobile) {
      openTradeEntrySheet()
      return
    }
    openManualTrade()
  }, [guardTradingAction, isMobile, openManualTrade, openTradeEntrySheet])

  const handleDockLog = useCallback(() => {
    if (!guardTradingAction()) return
    openTradeEntrySheet()
  }, [guardTradingAction, openTradeEntrySheet])

  const handleAssignStrategy = useCallback(
    async (tradeId: string, strategyName: string) => {
      if (!user) return

      const { error } = await supabase
        .from("trades")
        .update({ strategy_name: strategyName })
        .eq("id", tradeId)
        .eq("user_id", user.id)

      if (error) {
        toast({
          title: "Could not assign strategy",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      setTrades((prev) =>
        prev.map((trade) =>
          trade.id === tradeId ? { ...trade, strategy_name: strategyName } : trade,
        ),
      )
      toast({
        title: "Strategy assigned",
        description: `${strategyName} saved to this trade.`,
      })
    },
    [supabase, toast, user],
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
    const dayLabel = new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
    const confirmed = window.confirm(
      `Remove all journal CSV trades on ${dayLabel}? Manual entries on this day are kept.`,
    )
    if (!confirmed) return

    try {
      const { deletedCount } = await deleteJournalCsvImports({ tradeDate: dateKey })
      await fetchTrades(user.id)
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
    
    const { error } = await supabase
      .from("trades")
      .delete()
      .eq("id", tradeToDelete.id)
      .eq("user_id", user.id) // Security: only delete own trades

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Trade deleted",
        description: `${tradeToDelete.pair} trade has been removed.`,
      })
      if (selectedTrade?.id === tradeToDelete.id) {
        setSelectedTrade(null)
      }
      fetchTrades(user.id)
    }

    setIsDeleting(false)
    setIsDeleteModalOpen(false)
    setTradeToDelete(null)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingTrade(null)
    setConvertSessionId(null)
    setTradeJournalMode("log")
    setLinkedPlan(null)
    setPostSaveDiscipline(null)
    setRiskGuardOpen(false)
    setRiskGuardResult(null)
    setForm(
      createInitialTradeForm({
        risk_percent: String(settingsForm.max_risk_per_trade),
      }),
    )
  }

  // Calculate live analytics from trades (scoped to active account)
  const startingBalance =
    activeAccount?.starting_balance ??
    userSettings?.starting_balance ??
    settingsForm.starting_balance ??
    DEFAULT_USER_SETTINGS.starting_balance
  const maxRiskPerTrade = userSettings?.max_risk_per_trade ?? settingsForm.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade
  const showTradesSkeleton =
    (isLoadingTrades && trades.length === 0 && !dashboardLoadTimedOut) ||
    (isLoadingAccounts && !activeAccount && Boolean(user))
  const showFirstRunSetup =
    Boolean(user) && !showTradesSkeleton && accountTrades.length === 0 && !dashboardPreferences.onboardingCompleted
  const showProfileSkeleton =
    isLoadingProfile && !userProfile && !dashboardLoadTimedOut
  const showLoadFallbackBanner = !!tradesLoadError
  const profileCard = buildUserProfileCardProps({
    profile: userProfile ?? DEFAULT_USER_PROFILE,
    email: user?.email,
    propFirmSize: activeAccount?.name ?? settingsForm.prop_firm_size,
    isLoading: showProfileSkeleton,
  })
  const usingEmailFallback =
    !showProfileSkeleton &&
    !userProfile?.first_name?.trim() &&
    !userProfile?.last_name?.trim()
  const totalPnL = accountTrades.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)
  const accountBalance = startingBalance + totalPnL
  const winCount = accountTrades.filter((t) => t.result === "WIN").length
  const winRate = accountTrades.length > 0 ? Math.round((winCount / accountTrades.length) * 100) : 0
  const tradesWithVerifiedRisk = accountTrades.filter((t) => t.risk_percent != null)
  const avgRisk =
    tradesWithVerifiedRisk.length > 0
      ? tradesWithVerifiedRisk.reduce((sum, t) => sum + (t.risk_percent ?? 0), 0) /
        tradesWithVerifiedRisk.length
      : settingsForm.max_risk_per_trade
  const todayTrades = getTodayTrades(accountTrades)
  const viewingClosedTradeId = useMemo(() => {
    const tradeId = searchParams.get("trade")?.trim()
    if (!tradeId) return null
    const trade = accountTrades.find((row) => String(row.id) === tradeId)
    if (!trade?.result?.trim()) return null
    return tradeId
  }, [searchParams, accountTrades])

  useTradingAlerts({
    userId: user?.id,
    trades: accountTrades,
    settings: settingsForm,
    startingBalance,
  })

  // Calculate violation stats
  const tradesWithViolations = accountTrades.map((t) => ({
    ...t,
    violations: getTradeViolations(t, maxRiskPerTrade)
  }))
  const violationCount = tradesWithViolations.filter((t) => t.violations.length > 0).length
  const cleanCount = accountTrades.length - violationCount

  function clearSessionState() {
    const previousUserId = loadedDashboardUserRef.current ?? user?.id
    loadedDashboardUserRef.current = null
    clearClientSessionData(previousUserId)
    clearLastActiveAt()
    setUser(null)
    setTrades([])
    setUserSettings(null)
    setUserProfile(null)
    setTradesLoadError(null)
    setIsLoadingTrades(false)
    setIsLoadingProfile(false)
    dashboardLoadTimedOutRef.current = false
    setDashboardLoadTimedOut(false)
    tradesFetchSettledRef.current = false
    clearGlobalLoadTimeout()
    setIsModalOpen(false)
    setIsSettingsOpen(false)
    setIsDeleteModalOpen(false)
    setSelectedTrade(null)
    setEditingTrade(null)
    setTradeToDelete(null)
  }

  async function handleLogout() {
    if (signingOutRef.current || isLoggingOut) return

    signingOutRef.current = true
    setIsLoggingOut(true)

    toast({
      title: "Signing out...",
      description: "Redirecting to login.",
    })

    clearSessionState()

    await clearLocalAuthSession(supabase)
    void signOutWithTimeout(supabase)

    // Hard redirect — client router.replace can hang if cookies lag behind middleware.
    redirectToLogin()
    window.setTimeout(() => redirectToLogin(), 1500)
  }

  if (isLoggingOut || signingOutRef.current) {
    return <SigningOutScreen />
  }

  if (!user && !isLoadingTrades && !dashboardLoadTimedOut) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <div className="border-b border-white/[0.06] bg-black/40 px-4 py-4 md:px-6">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <div className="size-9 animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="h-4 w-24 animate-pulse rounded bg-white/[0.06]" />
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-3 py-6 md:px-6">
          <DashboardOverviewSkeleton />
        </div>
      </div>
    )
  }

  return (
    <AIContextProvider
      userId={user?.id}
      refreshKey={
        accountTrades.length +
        plannedSessions.length +
        coachFeedbackRefreshKey +
        accountContextRefreshSalt
      }
      maxRiskPerTrade={maxRiskPerTrade}
      onCoachSessionChange={handleCoachSessionChangeFromHq}
      onCoachCompleted={handleCoachCompletedFromHq}
      onLogPlannedTrade={(sessionId) => void handleConvertPlannedTrade(sessionId)}
    >
      <CommandCenterBridge
        onBindOpen={bindOpenCommandCenter}
        onBindPreTrade={bindOpenPreTradeCoach}
        onCoachSessionIdChange={setCoachSessionId}
      />
    <>
    <ConnectedDashboardChrome
      activeTab={activeTab}
      tradeModalOpen={isModalOpen}
      profileCard={profileCard}
      showProfileEmptyHint={usingEmailFallback}
      onOpenSettings={() => setIsSettingsOpen(true)}
      onLogout={() => void handleLogout()}
      isLoggingOut={isLoggingOut}
      showFab={Boolean(user)}
      showSignalBell={Boolean(user)}
      aiLauncher={user ? <CommandCenterLauncher /> : null}
      onSignalAlertClick={(signal: TradingViewSignalListItem) => {
        setActiveTab("journal")
        setIsSettingsOpen(false)
        if (signal.coach_session_id && openPreTradeCoachRef.current) {
          void openPreTradeCoachRef.current({
            sessionId: signal.coach_session_id,
            plannedContext: buildPlannedContextFromSignalItem(signal, maxRiskPerTrade),
          })
          if (user?.id) markRitualCoachEngaged(user.id)
          return
        }
        if (signal.coach_session_id) {
          router.replace(getTradingViewSignalHref(signal))
        } else {
          router.replace(getDashboardTabHref("journal"))
          void refreshPlannedSessions(undefined, true)
        }
      }}
      onFabClick={handleFabClick}
      fabDisabled={!tradingRules.canLogTrade}
      fabDisabledReason={tradingRules.blockMessage ?? undefined}
      showMobileDock={Boolean(user)}
      onDockHome={() => {
        setActiveTab("dashboard")
        router.replace(getDashboardHomeHref())
      }}
      onDockCoach={() => {
        openCommandCenterRef.current()
        if (user?.id) markRitualCoachEngaged(user.id)
      }}
      onDockLog={handleDockLog}
      onDockPlanner={() => router.push("/trade-planner")}
      accountSwitcher={accountSwitcher}
      banner={
        <>
          <TradingRulesBanner
            snapshot={tradingRules.snapshot}
            onRunCooldownCoach={() => tradingRules.setCooldownModalOpen(true)}
          />
          {showLoadFallbackBanner ? (
            <DashboardInsetPanel className="border-warning/20 bg-warning/[0.06] px-4 py-3">
              <p className="text-[12px] font-medium text-warning-muted/90">{tradesLoadError}</p>
            </DashboardInsetPanel>
          ) : null}
        </>
      }
    >
        <TabTransition activeTab={activeTab}>
          {activeTab === "dashboard" && (
            showTradesSkeleton ? (
              <DashboardOverviewSkeleton />
            ) : (
              <div className="hq-content space-y-5">
                {accountTrades.length === 0 ? (
                  <FirstRunBanner
                    onLogTrade={() => openManualTrade()}
                    onOpenWarRoom={() => router.push("/war-room")}
                  />
                ) : null}

                <TodaysMissionCard
                  settings={settingsForm}
                  trades={accountTrades}
                />

                {activeAccount ? (
                  <HqDashboard
                    trades={accountTrades}
                    winRate={winRate}
                    activeAccount={activeAccount}
                    settings={settingsForm}
                    tradingRulesSnapshot={tradingRules.snapshot}
                    traderFirstName={userProfile?.first_name}
                    onOpenCoach={() => void handleOpenCoach()}
                    onOpenWarRoom={() => router.push("/war-room")}
                    onOpenJournal={() => {
                      setActiveTab("journal")
                      router.replace(getDashboardTabHref("journal"))
                    }}
                    onOpenPlanner={(pair) => {
                      if (pair) {
                        router.push(`/trade-planner?pair=${encodeURIComponent(pair)}`)
                        return
                      }
                      router.push("/trade-planner")
                    }}
                    onViewTrade={(trade) => router.push(getTradeReplayHref(trade.id))}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                  />
                ) : null}

                <PrimaryLeakCardWithSettings
                  trades={accountTrades}
                  settings={settingsForm}
                  className="today-hero-leak"
                />

                <RiskGuardBanner
                  trades={accountTrades}
                  settings={settingsForm}
                  startingBalance={startingBalance}
                />

                <CollapsibleDashboardSection
                  id="dashboard-performance"
                  title="Performance"
                  subtitle="Equity and weekly stats"
                  open={performanceSectionOpen}
                  onOpenChange={setPerformanceSectionOpen}
                  defaultOpen={false}
                  collapseOnMobile
                  className="dashboard-section scroll-mt-24"
                >
                  <div className="dashboard-stagger grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
                    <LazyEquityCurveChart trades={accountTrades} startingBalance={startingBalance} />
                    <LazyWeeklyPerformance trades={accountTrades} />
                  </div>
                  <p className="mt-2 text-center text-[10px] text-muted-foreground/65">
                    Deeper charts and weekly review in{" "}
                    <button
                      type="button"
                      className="font-medium text-cyan-glow/85 underline-offset-2 hover:text-cyan-glow hover:underline"
                      onClick={() => router.push("/analytics")}
                    >
                      Analytics
                    </button>
                    .
                  </p>
                </CollapsibleDashboardSection>

                <CollapsibleDashboardSection
                  title="Intelligence"
                  subtitle="Patterns and coach memory"
                  defaultOpen={false}
                  collapseOnMobile
                  className="dashboard-section"
                >
                  <div className="dashboard-stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
                    <CalendarHeatmapPlaceholder trades={accountTrades} />
                    <AITradeCoachPlaceholder
                      trades={accountTrades}
                      maxRiskPerTrade={settingsForm.max_risk_per_trade}
                      patternMemoryRefreshKey={coachFeedbackRefreshKey}
                      onOpenCompanion={() => openCommandCenterRef.current()}
                    />
                  </div>
                </CollapsibleDashboardSection>
              </div>
            )
          )}

          {activeTab === "strategies" && (
            <section className="dashboard-section space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="dashboard-section-title mb-0">Strategies</p>
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className="h-9 border-cyan-glow/20 bg-cyan-glow/[0.04] text-cyan-glow hover:bg-cyan-glow/[0.08]"
                >
                  <a href="/strategy">
                    <Brain className="mr-2 size-4" />
                    Strategy Playbook
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-9 border-violet-500/25 bg-violet-500/[0.06] text-violet-200 hover:bg-violet-500/10"
                >
                  <a href="/strategy-brain">Strategy Brain</a>
                </Button>
              </div>
              <LazyStrategyPerformance
                trades={accountTrades}
                isLoading={showTradesSkeleton}
                loadError={tradesLoadError}
                onPlanTrade={openPlanTrade}
                onAssignStrategy={handleAssignStrategy}
              />
            </section>
          )}

          {activeTab === "journal" && (
            showTradesSkeleton ? (
              <section className="dashboard-section">
                <p className="dashboard-section-title">Trade Journal</p>
                <div className="dashboard-stagger">
                  <TableSkeleton />
                </div>
              </section>
            ) : (
              <div className="dashboard-stagger space-y-3">
                <RiskGuardBanner
                  trades={accountTrades}
                  settings={settingsForm}
                  startingBalance={startingBalance}
                />
                <CollapsibleDashboardSection
                  id="weekly-debrief-panel"
                  title="Weekly debrief"
                  subtitle="Execution week — trades, coach sessions, corrective focus"
                  defaultOpen={false}
                  collapseOnMobile
                >
                  <LazyWeeklyDebriefPanel
                    onViewTrade={(tradeId) => router.push(getTradeReplayHref(tradeId))}
                  />
                </CollapsibleDashboardSection>
                <LazyJournalCommandCenter
                  trades={accountTrades}
                  startingBalance={startingBalance}
                  viewingClosedTradeId={viewingClosedTradeId}
                  plannedSessions={plannedSessions}
                  isLoadingPlanned={isLoadingPlannedSessions}
                  deletingSessionId={deletingPlannedSessionId}
                  onContinueCoach={(sessionId) => void handleContinuePlannedCoach(sessionId)}
                  onConvertToTrade={(sessionId) => void handleConvertPlannedTrade(sessionId)}
                  onDeletePlanned={(sessionId) => void handleDeletePlannedSession(sessionId)}
                  onNewCoach={() => void handleOpenCoach(buildEmptyPlannedContext())}
                  onEditTrade={handleEditTrade}
                  onDeleteTrade={handleDeleteClick}
                  onViewTrade={(trade) => router.push(getTradeReplayHref(trade.id))}
                  onScreenshotClick={(trade) =>
                    setScreenshotViewer({
                      url: trade?.screenshot_url ?? null,
                      label: trade?.pair ?? "Trade",
                    })
                  }
                  onClearJournalCsvDay={(dateKey) => void handleClearJournalCsvDay(dateKey)}
                  onLogTrade={openManualTrade}
                  headerActions={
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsJournalImportOpen(true)}
                        className="h-9 w-full border border-[var(--border-subtle)] bg-transparent text-text-secondary hover:bg-white/[0.04] sm:w-auto"
                      >
                        <FileUp className="mr-2 size-4" />
                        Import CSV
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => openPlanTrade()}
                        className="h-9 w-full border border-[var(--border-subtle)] bg-transparent text-text-secondary hover:bg-white/[0.04] sm:w-auto"
                      >
                        <ClipboardCheck className="mr-2 size-4" />
                        Setup scoring
                      </Button>
                      <Button
                        type="button"
                        onClick={() => openManualTrade()}
                        className="h-9 w-full btn-primary sm:w-auto"
                      >
                        <Plus className="mr-2 size-4" />
                        New trade
                      </Button>
                    </div>
                  }
                />
              </div>
            )
          )}
        </TabTransition>
    </ConnectedDashboardChrome>

      <TradeRiskGuardModal
        open={riskGuardOpen}
        result={riskGuardResult}
        pairLabel={form.pair ? `${form.pair} ${form.direction}` : undefined}
        isSubmitting={isSubmitting}
        onCancel={handleRiskGuardCancel}
        onConfirm={handleRiskGuardConfirm}
      />

      <JournalImportModal
        open={isJournalImportOpen}
        onClose={() => setIsJournalImportOpen(false)}
        onImported={() => {
          if (user?.id) void fetchTrades(user.id)
          toast({
            title: "Journal updated",
            description: "Imported entries are now in your Trade Journal table.",
          })
        }}
      />

      <AddTradeModal
        open={isModalOpen}
        onClose={closeModal}
        form={form}
        onFormChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        isEditing={!!editingTrade}
        journalMode={editingTrade ? "edit" : tradeJournalMode}
        onJournalModeChange={setTradeJournalMode}
        existingStrategyNames={collectStrategyNamesFromTrades(accountTrades)}
        startingBalance={startingBalance}
        maxRiskPerTrade={maxRiskPerTrade}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        isDragging={isDragging}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onScreenshotUpload={handleScreenshotUpload}
        onScreenshotRemove={() => setForm((prev) => ({ ...prev, screenshot_url: "" }))}
        onScreenshotPreview={() =>
          setScreenshotViewer({ url: form.screenshot_url, label: `${form.pair || "Trade"} · MT5` })
        }
        onReflectionChartUpload={(file) => void handleReflectionChartUpload(file)}
        onReflectionChartRemove={() => setForm((prev) => ({ ...prev, reflection_chart_url: "" }))}
        onReflectionChartPreview={() =>
          setScreenshotViewer({
            url: form.reflection_chart_url,
            label: `${form.pair || "Trade"} · TradingView reflection`,
          })
        }
        onMt5Autofill={() => void handleMt5ScreenshotAutofill()}
        isMt5Autofilling={isMt5Autofilling}
        mt5AutofillSignal={mt5AutofillSignal}
        onOpenCoach={() =>
          void handleOpenCoach(buildPlannedContextFromForm(form, maxRiskPerTrade))
        }
        canRepeatLast={!editingTrade && accountTrades.length > 0}
        repeatSourceLabel={getMostRecentTradeForRepeat(accountTrades)?.pair}
        onRepeatLast={() => {
          const source = getMostRecentTradeForRepeat(accountTrades)
          if (!source) return
          setForm(buildRepeatTradeDraft(source))
          toast({
            title: "Last setup loaded",
            description: "Update result, P&L, and psychology before saving.",
          })
        }}
        linkedPlan={linkedPlan}
        onLinkedPlanChange={setLinkedPlan}
        postSaveDiscipline={postSaveDiscipline}
      />

      <FirstRunSetupModal
        open={showFirstRunSetup}
        form={settingsForm}
        isSaving={isSavingSettings}
        onComplete={completeFirstRunSetup}
        onOpenWarRoom={() => router.push("/war-room")}
      />

      <TradeEntryActionSheet
        open={tradeEntrySheetOpen}
        onOpenChange={setTradeEntrySheetOpen}
        onPlanSetup={() => openPlanTrade()}
        onLogResult={() => openManualTrade()}
      />

      <AccountSettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        form={settingsForm}
        onFormChange={(updates) => setSettingsForm((prev) => ({ ...prev, ...updates }))}
        onSubmit={saveUserSettings}
        isSaving={isSavingSettings}
        accountBalance={accountBalance}
        totalPnL={totalPnL}
        accounts={tradingAccounts}
        activeAccountId={activeAccountId}
        accountsLoading={isLoadingAccounts}
        accountsSaving={isSavingAccounts}
        accountsError={accountsError}
        onCreateAccount={createAccount}
        onUpdateAccount={updateAccount}
        onDeleteAccount={deleteAccount}
        onSwitchAccount={(accountId) => void switchAccount(accountId)}
        onMt5TradeSynced={() => {
          if (user?.id) void fetchTrades(user.id)
        }}
      />

      <CooldownUnlockModal
        open={tradingRules.cooldownModalOpen}
        accountId={activeAccountId}
        traderFirstName={userProfile?.first_name}
        minEmotionalScore={tradingRules.snapshot?.rules.min_emotional_score ?? 7}
        onClose={() => tradingRules.setCooldownModalOpen(false)}
        onCompleted={(unlocked, message) => {
          toast({
            title: unlocked ? "Trading unlocked" : "Not ready yet",
            description: message,
            variant: unlocked ? "default" : "destructive",
          })
          void tradingRules.refresh()
          void loadAccounts()
        }}
      />

      {isDeleteModalOpen && tradeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="dashboard-modal-backdrop"
            onClick={() => {
              setIsDeleteModalOpen(false)
              setTradeToDelete(null)
            }}
          />

          <div className="dashboard-modal-panel relative mx-4 w-full max-w-md border-loss/20">
              <div className="relative border-b border-white/[0.06] px-6 py-5">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-loss/[0.08] via-transparent to-transparent" />
                <div className="relative flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-[10px] border border-loss/20 bg-loss/[0.08]">
                    <Trash2 className="size-4 text-loss" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Delete Trade</h2>
                    <p className="text-[11px] text-muted-foreground/70">This action cannot be undone</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="mb-4 text-[13px] text-muted-foreground">
                  Are you sure you want to delete this trade?
                </p>
                
                <div className="dashboard-inset-panel space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">{tradeToDelete.pair}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      tradeToDelete.result === "WIN" 
                        ? "bg-profit/20 text-profit" 
                        : tradeToDelete.result === "LOSS"
                        ? "bg-loss/20 text-loss"
                        : "bg-muted/50 text-muted-foreground"
                    }`}>
                      {tradeToDelete.result}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Direction:</span>
                      <span className={`ml-1 ${tradeToDelete.direction === "BUY" ? "text-profit" : "text-loss"}`}>
                        {tradeToDelete.direction}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">P&L:</span>
                      <span className={`ml-1 font-medium ${getPnLTextClass(tradeToDelete.pnl, tradeToDelete.result)}`}>
                        {formatPnL(tradeToDelete.pnl, tradeToDelete.result)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDeleteModalOpen(false)
                      setTradeToDelete(null)
                    }}
                    className="flex-1 h-11 border-border/50 hover:bg-secondary/50"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={confirmDeleteTrade}
                    disabled={isDeleting}
                    className="flex-1 h-11 bg-loss hover:bg-loss/90 text-white"
                  >
                    {isDeleting ? (
                      <div className="flex items-center gap-2">
                        <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Deleting...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Trash2 className="size-4" />
                        Delete Trade
                      </div>
                    )}
                  </Button>
                </div>
              </div>
          </div>
        </div>
      )}

      <ScreenshotViewerModal
        open={!!screenshotViewer}
        imageUrl={screenshotViewer?.url ?? null}
        title={screenshotViewer?.label}
        onClose={() => setScreenshotViewer(null)}
      />

      <TradeDetailsModal
        trade={selectedTrade}
        maxRiskPerTrade={maxRiskPerTrade}
        coachFeedbackRefreshKey={coachFeedbackRefreshKey}
        onClose={() => setSelectedTrade(null)}
        onEdit={(trade) => handleEditTrade(trade as Trade)}
        isScreenshotOpen={!!screenshotViewer}
        onScreenshotClick={(trade) =>
          setScreenshotViewer({ url: trade.screenshot_url ?? null, label: `${trade.pair} · MT5` })
        }
        onReflectionChartClick={(trade) =>
          setScreenshotViewer({
            url: trade.reflection_chart_url ?? null,
            label: `${trade.pair} · TradingView reflection`,
          })
        }
        onReflectionChartUpload={(trade, file) =>
          void handleReflectionChartUploadForTrade(trade as Trade, file)
        }
        isReflectionUploading={isUploading}
      />

      <VyronisScoreResultModal
        open={vyronisResultOpen}
        evaluation={lastVyronisEvaluation}
        pairLabel={lastVyronisPairLabel}
        onClose={() => setVyronisResultOpen(false)}
      />

      <VyronisCommandCenter />
      <Toaster />
    </>
    </AIContextProvider>
  )
}
