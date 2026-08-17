"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { X, Pencil, Trash2, Brain, FileUp, Plus, ClipboardCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { useTradeJournal } from "@/hooks/use-trade-journal"
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
import { AddTradeModal } from "@/components/dashboard/add-trade-modal"
import { collectStrategyNamesFromTrades } from "@/components/dashboard/strategy-name-select"
import { TradeDetailsModal } from "@/components/dashboard/trade-details-modal"
import { PlannedTradesSection } from "@/components/dashboard/planned-trades-section"
import { JournalImportModal } from "@/components/dashboard/journal-import-modal"
import {
  buildEmptyPlannedContext,
  buildPlannedContextFromForm,
} from "@/lib/trade-coach/planned-context"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import { createInitialTradeForm } from "@/lib/trade-form-config"
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
import { formatPnL, getPnLTextClass, getSignedPnL } from "@/lib/trade-utils"
import { resolveAccountBalance } from "@/lib/mt5/live-balance"
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
import { type VyronisJournalEvaluationRecord } from "@/lib/strategy/vyronis-journal-bridge"
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
import { CollapsibleDashboardSection } from "@/components/dashboard/collapsible-dashboard-section"
import { markRitualCoachEngaged } from "@/lib/daily-ritual"
import {
  buildRepeatTradeDraft,
  getMostRecentTradeForRepeat,
} from "@/lib/trade-quick-log"
import { RiskGuardBanner } from "@/components/dashboard/risk-guard-banner"
import { TradeRiskGuardModal } from "@/components/dashboard/trade-risk-guard-modal"
import { AIContextProvider } from "@/providers/ai-context-provider"
import { CommandCenterLauncher } from "@/components/command-center/command-center-launcher"
import { CommandCenterBridge } from "@/components/command-center/command-center-bridge"
import { VyronisCommandCenter } from "@/components/command-center/vyronis-command-center"
import {
  DASHBOARD_TRADE_SELECT,
  DASHBOARD_TRADE_SELECT_WITHOUT_REFLECTION,
  DASHBOARD_TRADE_SELECT_WITHOUT_TRADE_REFLECTION,
  DASHBOARD_TRADES_LIMIT,
} from "@/lib/trades/dashboard-trade-query"

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
  const [tradeEntrySheetOpen, setTradeEntrySheetOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
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
  const [performanceSectionOpen, setPerformanceSectionOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>("dashboard")
  const [isLoadingTrades, setIsLoadingTrades] = useState(false)
  const [tradesLoadError, setTradesLoadError] = useState<string | null>(null)
  const [dashboardLoadTimedOut, setDashboardLoadTimedOut] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const dashboardLoadTimedOutRef = useRef(false)
  const globalLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tradesFetchSettledRef = useRef(false)
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

  const accountTrades = useMemo(
    () => filterTradesForAccount(trades, activeAccountId, legacyTradeAccountId),
    [trades, activeAccountId, legacyTradeAccountId],
  )

  const startingBalance =
    activeAccount?.starting_balance ??
    userSettings?.starting_balance ??
    settingsForm.starting_balance ??
    DEFAULT_USER_SETTINGS.starting_balance

  const journal = useTradeJournal({
    supabase,
    user,
    activeAccountId,
    activeAccount,
    trades,
    setTrades,
    accountTrades,
    refetchTrades: (userId) => fetchTrades(userId),
    loadAccounts,
    startingBalance,
    settingsForm,
    userSettings,
    toast,
    tradingRules,
    openPreTradeCoach: (options) => openPreTradeCoachRef.current(options),
  })

  const {
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
    tradeToDelete,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    setTradeToDelete,
    isDeleting,
    handleDeleteClick,
    confirmDeleteTrade,
    riskGuardOpen,
    riskGuardResult,
    handleRiskGuardCancel,
    handleRiskGuardConfirm,
    vyronisResultOpen,
    setVyronisResultOpen,
    lastVyronisEvaluation,
    lastVyronisPairLabel,
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
    selectedTrade,
    setSelectedTrade,
    isJournalImportOpen,
    setIsJournalImportOpen,
    handleClearJournalCsvDay,
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
    handleCoachSessionChange: handleCoachSessionChangeFromHq,
    handleCoachCompleted: handleCoachCompletedFromHq,
    guardTradingAction,
    setEditingTrade,
    setConvertSessionId,
    refreshPlannedSessions,
  } = journal

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
  const { balance: accountBalance } = resolveAccountBalance({
    startingBalance,
    totalPnL,
    mt5Balance: userSettings?.mt5_balance,
    mt5LastPingAt: userSettings?.mt5_last_ping_at,
    mt5LastSyncAt: userSettings?.mt5_last_sync_at,
  })
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

  useEffect(() => {
    if (!user?.id) return

    const refreshMt5AndAccounts = () => {
      if (document.visibilityState !== "visible") return
      void fetchUserSettings(user.id)
      void loadAccounts()
    }

    const interval = setInterval(refreshMt5AndAccounts, 60_000)
    window.addEventListener("focus", refreshMt5AndAccounts)

    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", refreshMt5AndAccounts)
    }
  }, [user?.id, loadAccounts])

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
                    mt5Balance={userSettings?.mt5_balance ?? null}
                    mt5LastPingAt={userSettings?.mt5_last_ping_at ?? null}
                    mt5LastSyncAt={userSettings?.mt5_last_sync_at ?? null}
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
