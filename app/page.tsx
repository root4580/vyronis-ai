"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { X, Pencil, Trash2, Brain, FileUp, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {
  StatsCards,
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
import { tradeFormPatchFromMt5Autofill } from "@/lib/journal/mt5-trade-form-autofill"
import {
  buildEmptyPlannedContext,
  buildPlannedContextFromForm,
  buildTradeFormFromPlannedSession,
} from "@/lib/trade-coach/planned-context"
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
import { DEFAULT_DASHBOARD_PREFERENCES } from "@/lib/user-preferences"
import {
  buildDashboardHomePath,
  getDashboardHomeHref,
  getDashboardTabHref,
  parseTabSearchParam,
} from "@/lib/dashboard-nav"
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
import { DashboardQuickNav } from "@/components/dashboard/dashboard-quick-nav"
import { DashboardRecentTradesSection } from "@/components/dashboard/dashboard-recent-trades-section"
import { formatPnL, getPnLTextClass, getSignedPnL, normalizePnL, normalizeTradeResultForDb } from "@/lib/trade-utils"
import { calculateRiskReward, parseOptionalNumber } from "@/lib/trade-form-utils"
import { clearLocalAuthSession, redirectToLogin, signOutWithTimeout } from "@/lib/auth-sign-out"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { AuthLoadingState } from "@/components/auth/auth-loading-state"
import { clearClientSessionData } from "@/lib/client-session"
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
  generatePatternMemory,
  type PatternMemoryTrade,
} from "@/lib/trade-coach/pattern-memory"
import {
  computeSetupScore,
  type SetupCoachingInsight,
  type SetupScoreBreakdown,
} from "@/lib/trade-coach/setup-score-engine"
import { PrimaryLeakCardWithSettings } from "@/components/behavior/primary-leak-card"
import { WeeklyWatchlistBanner } from "@/components/dashboard/weekly-watchlist-banner"
import { TodayHeroStrip } from "@/components/dashboard/today-hero-strip"
import { checkCoachReadiness } from "@/lib/strategy-brain/coach-readiness-gate"
import { getTradingViewSignalHref } from "@/lib/tradingview/signal-navigation"
import { buildPlannedContextFromSignalItem } from "@/lib/tradingview/planned-context-from-list-item"
import type { TradingViewSignalListItem } from "@/lib/tradingview/types"
import { buildPlannedContextFromPairPlan } from "@/lib/strategy-brain/weekly-watchlist"
import { DashboardTrustStrip } from "@/components/dashboard/dashboard-trust-strip"
import { CollapsibleDashboardSection } from "@/components/dashboard/collapsible-dashboard-section"
import { markRitualCoachComplete, markRitualCoachEngaged } from "@/lib/daily-ritual"
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
  trade_date: string | null
  higher_timeframe: string | null
  entry_timeframe: string | null
  confirmation_timeframe: string | null
  confirmation_signal: string | null
  session: string | null
  screenshot_url: string | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
  risk_reward?: number | null
  emotion_after?: string | null
  mistake_tags?: string | null
  trade_notes?: string | null
  setup_score?: number | null
  setup_classification?: string | null
  setup_score_breakdown?: SetupScoreBreakdown | null
  setup_coaching_insights?: SetupCoachingInsight[] | null
  import_source?: string | null
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
  
  if (trade.result === "LOSS" && (trade.emotion === "Revenge" || trade.emotion === "FOMO")) {
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
  const signingOutRef = useRef(false)
  const profileWarningShownRef = useRef(false)
  const loadedDashboardUserRef = useRef<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isMt5Autofilling, setIsMt5Autofilling] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [screenshotViewer, setScreenshotViewer] = useState<{ url: string | null; label: string } | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [coachSessionId, setCoachSessionId] = useState<string | null>(null)
  const [coachFeedbackRefreshKey, setCoachFeedbackRefreshKey] = useState(0)
  const [plannedSessions, setPlannedSessions] = useState<PlannedCoachSessionItem[]>([])
  const [riskGuardOpen, setRiskGuardOpen] = useState(false)
  const [riskGuardResult, setRiskGuardResult] = useState<TradeRiskGuardResult | null>(null)
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
  const openCommandCenterRef = useRef<() => void>(() => {})
  const openPreTradeCoachRef = useRef<
    (options?: { sessionId?: string; plannedContext?: PreTradePlannedContext }) => Promise<void>
  >(async () => {})
  const skipUrlTabSyncRef = useRef(true)
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
  const bindOpenPreTradeCoach = useCallback(
    (openPreTrade: (options?: { sessionId?: string; plannedContext?: PreTradePlannedContext }) => Promise<void>) => {
      openPreTradeCoachRef.current = openPreTrade
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
  
  async function handleScreenshotUpload(file: File) {
    const validationError = validateFile(file)
    if (validationError) {
      toast({
        title: "Invalid file",
        description: validationError,
        variant: "destructive",
      })
      return
    }
    
    setIsUploading(true)
    setUploadProgress(0)
    
    // Simulate progress for better UX (actual upload doesn't support progress)
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 150)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      })
      
      clearInterval(progressInterval)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }
      
      setUploadProgress(100)
      const { url } = await response.json()
      setForm((prev) => ({ ...prev, screenshot_url: url }))
      if (!editingTrade) {
        void applyMt5ScreenshotAutofill(url, form.pair || undefined)
      } else {
        toast({
          title: "Screenshot uploaded",
          description: "Tap Autofill from MT5 to update fields from the screenshot.",
        })
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload screenshot",
        variant: "destructive",
      })
    } finally {
      clearInterval(progressInterval)
      setIsUploading(false)
      setTimeout(() => setUploadProgress(0), 500)
    }
  }

  async function applyMt5ScreenshotAutofill(imageUrl: string, pairHint?: string) {
    setIsMt5Autofilling(true)
    try {
      const autofill = await fetchMt5ScreenshotAutofill({
        imageUrl,
        pairHint,
      })

      if (!autofill.available) {
        toast({
          title: "Screenshot saved — autofill skipped",
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

      const filled: string[] = []
      if (autofill.pair) filled.push(autofill.pair)
      if (autofill.direction) filled.push(autofill.direction)
      if (autofill.entry_price != null) filled.push("entry")
      if (autofill.stop_loss != null) filled.push("SL")
      if (autofill.take_profit != null) filled.push("TP")
      if (autofill.profit != null || autofill.result) filled.push("P&L")

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
    await applyMt5ScreenshotAutofill(imageUrl, form.pair || undefined)
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
          router.replace("/auth/login")
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

      if (error && /import_source|column .* does not exist/i.test(error.message)) {
        const fallback = await withTimeout(
          supabase
            .from("trades")
            .select(DASHBOARD_TRADE_SELECT)
            .eq("user_id", uid)
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
        dashboard_preferences: { activeTab: tab },
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
    const tradeId = searchParams.get("trade")
    if (!tradeId || trades.length === 0) return

    const trade = trades.find((row) => String(row.id) === String(tradeId))
    if (trade) {
      setSelectedTrade(trade)
    }
  }, [searchParams, trades])

  useEffect(() => {
    if (searchParams.get("action") !== "new-trade") return

    setEditingTrade(null)
    setConvertSessionId(null)
    setForm(createInitialTradeForm())
    setIsModalOpen(true)

    const tab = parseTabSearchParam(searchParams.get("tab")) ?? activeTab
    const params = new URLSearchParams()
    if (tab && tab !== "dashboard") {
      params.set("tab", tab)
    }
    const next = params.toString() ? `/?${params.toString()}` : "/"
    router.replace(next)
  }, [activeTab, router, searchParams])

  useEffect(() => {
    const coachPair = searchParams.get("coachPair")?.trim()
    if (!coachPair || !user?.id) return

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
      await openPreTradeCoachRef.current({ plannedContext })
      markRitualCoachEngaged(user.id)
      router.replace(buildDashboardHomePath(searchParams))
    })()
  }, [searchParams, user?.id, toast, router])

  useEffect(() => {
    const coachSession = searchParams.get("coach")?.trim()
    if (!coachSession || !user?.id) return

    void openPreTradeCoachRef.current({ sessionId: coachSession })
    markRitualCoachEngaged(user.id)
    setActiveTab("dashboard")
    const params = new URLSearchParams(searchParams.toString())
    params.delete("coach")
    params.delete("tab")
    const next = params.toString() ? `/?${params.toString()}` : getDashboardHomeHref()
    router.replace(next)
  }, [searchParams, user?.id, router])

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
  }, [user?.id])

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
      const planned = await fetchPlannedCoachSessions()
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

  async function handleContinuePlannedCoach(sessionId: string) {
    await handleOpenCoach(undefined, { sessionId })
  }

  async function handleConvertPlannedTrade(sessionId: string) {
    try {
      const session = await fetchCoachSession(sessionId)
      setConvertSessionId(sessionId)
      setCoachSessionId(sessionId)
      setEditingTrade(null)
      setForm(buildTradeFormFromPlannedSession(session))
      setIsModalOpen(true)
      toast({
        title: "Plan loaded",
        description: "Add the trade outcome and save to link this plan to your completed trade.",
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
      dashboard_preferences: { activeTab },
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

    if (!form.pair || !form.direction || !form.result || !form.pnl) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
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

    const resolvedSettings = normalizeUserSettings(userSettings ?? settingsForm)
    const guard = evaluateTradeRiskGuard({
      form,
      settings: resolvedSettings,
      startingBalance:
        userSettings?.starting_balance ?? settingsForm.starting_balance ?? DEFAULT_USER_SETTINGS.starting_balance,
      historicalTrades: trades.map((trade) => ({
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

    const extendedTradeData = {
      entry_price: parseOptionalNumber(form.entry_price),
      stop_loss: parseOptionalNumber(form.stop_loss),
      take_profit: parseOptionalNumber(form.take_profit),
      risk_reward: computedRiskReward,
      emotion_after: form.emotion_after.trim() || null,
      mistake_tags: form.mistake_tags.length > 0 ? form.mistake_tags.join(",") : null,
      trade_notes: editingTrade
        ? preserveRepeatMarkerOnEdit(editingTrade.trade_notes, form.trade_notes.trim())
        : form.trade_notes.trim() || null,
    }

    const normalizedResult = normalizeTradeResultForDb(form.result)

    const setupScoreInput = {
      direction: form.direction,
      result: normalizedResult,
      emotion: form.emotion || "Calm",
      emotion_after: form.emotion_after.trim() || null,
      setup: form.setup || "A+ Setup",
      strategy_name: form.strategy_name || null,
      risk_percent: form.risk_percent ? parseFloat(form.risk_percent) : 1,
      rule_followed: form.rule_followed,
      session: form.session || null,
      trade_date: form.trade_date || new Date().toISOString().split("T")[0],
      confirmation_signal: form.confirmation_signal || null,
      higher_timeframe: form.higher_timeframe || null,
      entry_timeframe: form.entry_timeframe || null,
      confirmation_timeframe: form.confirmation_timeframe || null,
      mistake_tags: form.mistake_tags.length > 0 ? form.mistake_tags.join(",") : null,
      entry_price: parseOptionalNumber(form.entry_price),
      stop_loss: parseOptionalNumber(form.stop_loss),
      take_profit: parseOptionalNumber(form.take_profit),
      risk_reward: computedRiskReward,
    }

    const maxRiskPerTrade =
      userSettings?.max_risk_per_trade ?? settingsForm.max_risk_per_trade ?? 1

    const patternMemory = generatePatternMemory({
      trades: trades.map(
        (trade): PatternMemoryTrade => ({
          id: trade.id,
          direction: trade.direction,
          result: trade.result,
          pnl: trade.pnl,
          emotion: trade.emotion,
          emotion_after: trade.emotion_after,
          strategy_name: trade.strategy_name,
          session: trade.session,
          risk_percent: trade.risk_percent,
          rule_followed: trade.rule_followed,
          mistake_tags: trade.mistake_tags,
          confirmation_signal: trade.confirmation_signal,
          trade_date: trade.trade_date,
          created_at: trade.created_at,
        }),
      ),
      feedback: [],
      sessions: [],
      maxRiskPerTrade,
    })

    const setupScore = computeSetupScore({
      trade: setupScoreInput,
      maxRiskPerTrade,
      patterns: patternMemory.patterns,
      historicalTrades: trades.map((trade) => ({
        direction: trade.direction,
        result: trade.result,
        emotion: trade.emotion,
        emotion_after: trade.emotion_after,
        setup: trade.setup,
        strategy_name: trade.strategy_name,
        risk_percent: trade.risk_percent,
        rule_followed: trade.rule_followed,
        session: trade.session,
        trade_date: trade.trade_date,
        confirmation_signal: trade.confirmation_signal,
        higher_timeframe: trade.higher_timeframe,
        entry_timeframe: trade.entry_timeframe,
        confirmation_timeframe: trade.confirmation_timeframe,
        mistake_tags: trade.mistake_tags,
        entry_price: trade.entry_price,
        stop_loss: trade.stop_loss,
        take_profit: trade.take_profit,
        risk_reward: trade.risk_reward,
      })),
    })

    const tradeData = {
      pair: form.pair,
      direction: form.direction,
      result: normalizedResult,
      pnl: normalizePnL(parseFloat(form.pnl), form.result),
      emotion: form.emotion || "Calm",
      setup: form.setup || "A+ Setup",
      strategy_name: form.strategy_name || null,
      risk_percent: form.risk_percent ? parseFloat(form.risk_percent) : 1,
      rule_followed: form.rule_followed,
      user_id: activeUserId,
      trade_date: form.trade_date || new Date().toISOString().split("T")[0],
      higher_timeframe: form.higher_timeframe || null,
      entry_timeframe: form.entry_timeframe || null,
      confirmation_timeframe: form.confirmation_timeframe || null,
      confirmation_signal: form.confirmation_signal || null,
      session: form.session || null,
      screenshot_url: form.screenshot_url || null,
      setup_score: setupScore.score,
      setup_classification: setupScore.classification,
      setup_score_breakdown: setupScore.breakdown,
      setup_coaching_insights: setupScore.insights,
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

    if (error && /column|schema cache/i.test(error.message)) {
      const {
        entry_price,
        stop_loss,
        take_profit,
        risk_reward,
        emotion_after,
        mistake_tags,
        trade_notes,
        setup_score,
        setup_classification,
        setup_score_breakdown,
        setup_coaching_insights,
        ...coreTradeData
      } = tradeData
      result = await persistTrade(coreTradeData as typeof tradeData)
      error = result.error
      usedFallbackSave = !error
    }

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } else {
      const savedTradeId = editingTrade?.id ?? result.data?.id
      toast({
        title: editingTrade ? "Trade updated" : "Trade saved",
        description: usedFallbackSave
          ? `${form.pair} saved without extended DB columns. Run supabase/trade-fields-migration.sql and supabase/007-setup-score-columns.sql in Supabase.`
          : `${form.pair} ${form.direction} ${form.result} — ${setupScore.classification} (${setupScore.score}/100).`,
        variant: usedFallbackSave ? "destructive" : "default",
      })
      setForm(createInitialTradeForm())
      setEditingTrade(null)
      setIsModalOpen(false)
      fetchTrades(activeUserId)
      if (savedTradeId) {
        void syncTradeLearningMemory(savedTradeId).catch(() => undefined)
        void finalizeCoachForTrade(savedTradeId, convertSessionId ?? coachSessionId)
      }
    }
    setIsSubmitting(false)
    setRiskGuardResult(null)
  }

  const openManualTrade = useCallback((tradeDate?: string) => {
    setSelectedTrade(null)
    setEditingTrade(null)
    setConvertSessionId(null)
    setForm(createInitialTradeForm(tradeDate ? { trade_date: tradeDate } : undefined))
    setIsModalOpen(true)
  }, [])

  function handleEditTrade(trade: Trade) {
    setSelectedTrade(null)
    setEditingTrade(trade)
    setForm({
      pair: trade.pair,
      direction: trade.direction,
      result: trade.result,
      pnl: Math.abs(trade.pnl).toString(),
      emotion: trade.emotion,
      emotion_after: trade.emotion_after || "",
      setup: trade.setup,
      strategy_name: trade.strategy_name || "",
      risk_percent: (trade.risk_percent || 1).toString(),
      rule_followed: trade.rule_followed !== false,
      trade_date: trade.trade_date || new Date().toISOString().split("T")[0],
      higher_timeframe: trade.higher_timeframe || "",
      entry_timeframe: trade.entry_timeframe || "",
      confirmation_timeframe: trade.confirmation_timeframe || "",
      confirmation_signal: trade.confirmation_signal || "",
      session: trade.session || "",
      screenshot_url: trade.screenshot_url || "",
      entry_price: trade.entry_price?.toString() || "",
      stop_loss: trade.stop_loss?.toString() || "",
      take_profit: trade.take_profit?.toString() || "",
      mistake_tags: parseMistakeTags(trade.mistake_tags),
      trade_notes: trade.trade_notes || "",
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
    setRiskGuardOpen(false)
    setRiskGuardResult(null)
    setForm(createInitialTradeForm())
  }

  // Calculate live analytics from trades
  const startingBalance = userSettings?.starting_balance ?? settingsForm.starting_balance ?? DEFAULT_USER_SETTINGS.starting_balance
  const maxRiskPerTrade = userSettings?.max_risk_per_trade ?? settingsForm.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade
  const showTradesSkeleton =
    isLoadingTrades && trades.length === 0 && !dashboardLoadTimedOut
  const showProfileSkeleton =
    isLoadingProfile && !userProfile && !dashboardLoadTimedOut
  const showLoadFallbackBanner = !!tradesLoadError
  const profileCard = buildUserProfileCardProps({
    profile: userProfile ?? DEFAULT_USER_PROFILE,
    email: user?.email,
    propFirmSize: settingsForm.prop_firm_size,
    isLoading: showProfileSkeleton,
  })
  const usingEmailFallback =
    !showProfileSkeleton &&
    !userProfile?.first_name?.trim() &&
    !userProfile?.last_name?.trim()
  const totalPnL = trades.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)
  const accountBalance = startingBalance + totalPnL
  const winCount = trades.filter(t => t.result === "WIN").length
  const winRate = trades.length > 0 ? Math.round((winCount / trades.length) * 100) : 0
  const avgRisk = trades.length > 0 ? trades.reduce((sum, t) => sum + (t.risk_percent || 1), 0) / trades.length : 1
  const todayTrades = getTodayTrades(trades)

  // Calculate violation stats
  const tradesWithViolations = trades.map(t => ({
    ...t,
    violations: getTradeViolations(t, maxRiskPerTrade)
  }))
  const violationCount = tradesWithViolations.filter(t => t.violations.length > 0).length
  const cleanCount = trades.length - violationCount

  function clearSessionState() {
    const previousUserId = loadedDashboardUserRef.current ?? user?.id
    loadedDashboardUserRef.current = null
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
    router.replace("/auth/login")

    void signOutWithTimeout(supabase).then(({ timedOut }) => {
      if (timedOut) {
        redirectToLogin()
      }
    })
  }

  if (isLoggingOut || signingOutRef.current) {
    return <SigningOutScreen />
  }

  if (!user && !isLoadingTrades && !dashboardLoadTimedOut) {
    return (
      <AuthLoadingState
        title="Vyronis AI"
        subtitle="Loading your dashboard…"
      />
    )
  }

  return (
    <AIContextProvider
      userId={user?.id}
      refreshKey={trades.length + plannedSessions.length + coachFeedbackRefreshKey}
      maxRiskPerTrade={maxRiskPerTrade}
      onCoachSessionChange={(sessionId) => setCoachSessionId(sessionId)}
      onCoachCompleted={(sessionId) => {
        if (user?.id) markRitualCoachComplete(user.id)
        void refreshPlannedSessions(undefined, true)
        toast({
          title: "Pre-trade complete",
          description: "Tap Log this trade in the coach or journal to link plan vs outcome.",
        })
        setCoachSessionId(sessionId)
      }}
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
      onFabClick={() => openManualTrade()}
      showMobileDock={Boolean(user)}
      onDockHome={() => {
        setActiveTab("dashboard")
        router.replace(getDashboardHomeHref())
      }}
      onDockJournal={() => {
        setActiveTab("journal")
        router.replace(getDashboardTabHref("journal"))
      }}
      onDockCoach={() => {
        openCommandCenterRef.current()
        if (user?.id) markRitualCoachEngaged(user.id)
      }}
      onDockLog={() => openManualTrade()}
      onDockWarRoom={() => router.push("/war-room")}
      onDockAnalytics={() => router.replace("/analytics")}
      banner={
        showLoadFallbackBanner ? (
          <DashboardInsetPanel className="border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
            <p className="text-[12px] font-medium text-amber-200/90">{tradesLoadError}</p>
          </DashboardInsetPanel>
        ) : null
      }
    >
        <TabTransition activeTab={activeTab}>
          {activeTab === "dashboard" && (
            showTradesSkeleton ? (
              <DashboardOverviewSkeleton />
            ) : (
              <div className="space-y-4 md:space-y-6">
                <StatsCards
                  accountBalance={accountBalance}
                  totalPnL={totalPnL}
                  winRate={winRate}
                  avgRisk={avgRisk}
                  maxRiskPerTrade={maxRiskPerTrade}
                  tradeCount={trades.length}
                />

                <DashboardTrustStrip
                  tradeCount={trades.length}
                  lastSyncedLabel={
                    lastSyncedAt
                      ? `Synced ${lastSyncedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                      : isLoadingTrades
                        ? "Syncing…"
                        : null
                  }
                />

                <WeeklyWatchlistBanner className="mb-1" />

                {user?.id ? (
                  <TodayHeroStrip
                    userId={user.id}
                    trades={trades}
                    maxRiskPerTrade={maxRiskPerTrade}
                    plannedSessions={plannedSessions}
                    onOpenWarRoom={() => router.push("/war-room")}
                    onOpenCoach={() => void handleOpenCoach()}
                    onOpenLog={() => openManualTrade()}
                    onOpenWeeklyDebrief={() => {
                      setActiveTab("journal")
                      router.replace(getDashboardTabHref("journal"))
                      window.setTimeout(() => {
                        document
                          .getElementById("weekly-debrief-panel")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }, 120)
                    }}
                    onCoachEngaged={() => {
                      if (user.id) markRitualCoachEngaged(user.id)
                    }}
                    onViewPerformance={openDashboardPerformance}
                  />
                ) : null}

                <DashboardQuickNav
                  onCalendar={() => {
                    setActiveTab("journal")
                    router.replace(getDashboardTabHref("journal"))
                  }}
                  onWarRoom={() => router.push("/war-room")}
                  onChat={() => {
                    openCommandCenterRef.current()
                    if (user?.id) markRitualCoachEngaged(user.id)
                  }}
                  onLog={() => openManualTrade()}
                  onStats={openDashboardPerformance}
                />

                <DashboardRecentTradesSection
                  trades={trades}
                  limit={3}
                  variant="compact"
                  onViewTrade={(trade) => router.push(`/journal/trade/${trade.id}`)}
                  onEdit={handleEditTrade}
                  onDelete={(trade) => {
                    setTradeToDelete(trade)
                    setIsDeleteModalOpen(true)
                  }}
                  onScreenshotClick={(trade) =>
                    setScreenshotViewer({ url: trade.screenshot_url, label: trade.pair })
                  }
                  onSeeAll={() => {
                    setActiveTab("journal")
                    router.replace(getDashboardTabHref("journal"))
                  }}
                />

                <PrimaryLeakCardWithSettings
                  trades={trades}
                  settings={settingsForm}
                  className="today-hero-leak"
                />

                <RiskGuardBanner
                  trades={trades}
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
                    <LazyEquityCurveChart trades={trades} startingBalance={startingBalance} />
                    <LazyWeeklyPerformance trades={trades} />
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
                    <CalendarHeatmapPlaceholder trades={trades} />
                    <AITradeCoachPlaceholder
                      trades={trades}
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
                trades={trades}
                isLoading={showTradesSkeleton}
                loadError={tradesLoadError}
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
                  trades={trades}
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
                    onViewTrade={(tradeId) => router.push(`/journal/trade/${tradeId}`)}
                  />
                </CollapsibleDashboardSection>
                <LazyJournalCommandCenter
                  trades={trades}
                  startingBalance={startingBalance}
                  plannedSessions={plannedSessions}
                  isLoadingPlanned={isLoadingPlannedSessions}
                  deletingSessionId={deletingPlannedSessionId}
                  onContinueCoach={(sessionId) => void handleContinuePlannedCoach(sessionId)}
                  onConvertToTrade={(sessionId) => void handleConvertPlannedTrade(sessionId)}
                  onDeletePlanned={(sessionId) => void handleDeletePlannedSession(sessionId)}
                  onNewCoach={() => void handleOpenCoach(buildEmptyPlannedContext())}
                  onEditTrade={handleEditTrade}
                  onDeleteTrade={handleDeleteClick}
                  onViewTrade={(trade) => router.push(`/journal/trade/${trade.id}`)}
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
                        onClick={() => openManualTrade()}
                        className="h-9 w-full bg-cyan-glow/90 text-black hover:bg-cyan-glow sm:w-auto"
                      >
                        <Plus className="mr-2 size-4" />
                        New Trade
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsJournalImportOpen(true)}
                        className="h-9 w-full border-white/[0.08] bg-white/[0.03] text-foreground/90 hover:bg-white/[0.06] sm:w-auto"
                      >
                        <FileUp className="mr-2 size-4" />
                        Import CSV
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
          setScreenshotViewer({ url: form.screenshot_url, label: form.pair || "Trade chart" })
        }
        onMt5Autofill={() => void handleMt5ScreenshotAutofill()}
        isMt5Autofilling={isMt5Autofilling}
        onOpenCoach={() =>
          void handleOpenCoach(buildPlannedContextFromForm(form, maxRiskPerTrade))
        }
        canRepeatLast={!editingTrade && trades.length > 0}
        repeatSourceLabel={getMostRecentTradeForRepeat(trades)?.pair}
        onRepeatLast={() => {
          const source = getMostRecentTradeForRepeat(trades)
          if (!source) return
          setForm(buildRepeatTradeDraft(source))
          toast({
            title: "Last setup loaded",
            description: "Update result, P&L, and psychology before saving.",
          })
        }}
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
        onMt5TradeSynced={() => {
          if (user?.id) void fetchTrades(user.id)
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
          setScreenshotViewer({ url: trade.screenshot_url ?? null, label: trade.pair })
        }
      />

      <VyronisCommandCenter />
      <Toaster />
    </>
    </AIContextProvider>
  )
}
