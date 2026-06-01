"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { fetchCoachSession } from "@/lib/trade-coach/api-client"
import {
  applyPlannerCoachGateSoftening,
  checkCoachReadiness,
} from "@/lib/strategy-brain/coach-readiness-gate"
import { buildPlannedContextFromPairPlan } from "@/lib/strategy-brain/weekly-watchlist"
import { buildEmptyPlannedContext } from "@/lib/trade-coach/planned-context"
import type {
  PreTradePlannedContext,
  TradeCoachSessionWithMessages,
} from "@/lib/trade-coach/types"
import {
  archiveCommandCenterSession,
  fetchCommandCenterContext,
  sendCommandCenterChat,
  switchCommandCenterMode,
} from "@/lib/command-center/api-client"
import {
  readCommandCenterContextCache,
  writeCommandCenterContextCache,
} from "@/lib/command-center/context-cache"
import type {
  CommandCenterContext,
  CommandCenterMessageRecord,
  CommandCenterMode,
} from "@/lib/command-center/types"
import { fetchTradingRulesSnapshot } from "@/lib/trading-rules/api-client"
import { buildThinkingPhases } from "@/lib/intelligence/conversational-state-engine"
import { useToast } from "@/hooks/use-toast"

const OPEN_STATE_KEY = "vyronis.commandCenter.open"
const MODE_STATE_KEY = "vyronis.commandCenter.mode"
const FOCUS_STATE_KEY = "vyronis.commandCenter.focus"

type OpenPreTradeOptions = {
  sessionId?: string
  plannedContext?: PreTradePlannedContext
  /** Trade Planner sizing check-in — soften War Room hard blocks when levels are filled. */
  plannerCheckIn?: boolean
}

type AIContextProviderProps = {
  children: ReactNode
  userId?: string | null
  refreshKey?: number
  maxRiskPerTrade?: number
  onCoachSessionChange?: (sessionId: string | null) => void
  onCoachCompleted?: (sessionId: string) => void
  onLogPlannedTrade?: (sessionId: string) => void
}

type AIContextValue = {
  enabled: boolean
  isOpen: boolean
  isLoading: boolean
  isSending: boolean
  isThinking: boolean
  thinkingPhases: string[]
  streamingMessage: CommandCenterMessageRecord | null
  isTransitioning: boolean
  error: string | null
  mode: CommandCenterMode
  focusId: string | null
  context: CommandCenterContext | null
  coachSessionId: string | null
  coachPlannedContext: PreTradePlannedContext
  coachPreloadedSession: TradeCoachSessionWithMessages | null
  maxRiskPerTrade: number
  open: (mode?: CommandCenterMode) => void
  close: () => void
  openPreTradeCoach: (options?: OpenPreTradeOptions) => Promise<void>
  returnToCompanion: () => Promise<void>
  refresh: () => Promise<void>
  sendMessage: (input: {
    content: string
    imageUrl?: string | null
    imageUrls?: string[] | null
  }) => Promise<void>
  clearStreamingMessage: () => void
  handleCoachSessionChange: (sessionId: string | null) => void
  handleCoachSessionLoaded: (session: TradeCoachSessionWithMessages) => void
  handleCoachCompleted: (sessionId: string) => void
  logPlannedTrade: (sessionId: string) => void
  historySessionId: string | null
  viewingArchivedSession: boolean
  openHistorySession: (sessionId: string) => Promise<void>
  startNewSession: () => Promise<void>
}

const AIContext = createContext<AIContextValue | null>(null)

export function AIContextProvider({
  children,
  userId,
  refreshKey = 0,
  maxRiskPerTrade = 1,
  onCoachSessionChange,
  onCoachCompleted,
  onLogPlannedTrade,
}: AIContextProviderProps) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<CommandCenterMode>("companion")
  const [focusId, setFocusId] = useState<string | null>(null)
  const [context, setContext] = useState<CommandCenterContext | null>(null)
  const [coachSessionId, setCoachSessionId] = useState<string | null>(null)
  const [coachPlannedContext, setCoachPlannedContext] = useState<PreTradePlannedContext>(
    buildEmptyPlannedContext(),
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingPhases, setThinkingPhases] = useState<string[]>([])
  const [streamingMessage, setStreamingMessage] = useState<CommandCenterMessageRecord | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionRestored, setSessionRestored] = useState(false)
  const [historySessionId, setHistorySessionId] = useState<string | null>(null)
  const panelEpochRef = useRef(0)
  const needsFreshSessionRef = useRef(false)
  const preTradeOpenInFlightRef = useRef(false)
  const coachSessionCacheRef = useRef<Map<string, TradeCoachSessionWithMessages>>(new Map())
  const lastCoachContextFetchIdRef = useRef<string | null>(null)
  const contextRef = useRef<CommandCenterContext | null>(null)
  const loadGenerationRef = useRef(0)
  const [coachPreloadedSession, setCoachPreloadedSession] =
    useState<TradeCoachSessionWithMessages | null>(null)

  useEffect(() => {
    contextRef.current = context
  }, [context])

  const viewingArchivedSession = context?.viewingArchivedSession ?? false

  const enabled = context?.enabled ?? true

  const loadContext = useCallback(
    async (options?: { fresh?: boolean; showLoading?: boolean }) => {
      if (!userId) return

      const generation = ++loadGenerationRef.current
      const useFresh =
        options?.fresh ??
        (needsFreshSessionRef.current && mode === "companion" && !historySessionId)
      if (useFresh) needsFreshSessionRef.current = false

      const showLoading = options?.showLoading ?? !contextRef.current
      if (showLoading) setIsLoading(true)
      setError(null)

      const cached = readCommandCenterContextCache(
        userId,
        mode,
        focusId,
        historySessionId,
      )
      if (cached && showLoading) {
        setContext(cached)
        setIsLoading(false)
      }

      try {
        const lean = await fetchCommandCenterContext(mode, focusId, historySessionId, {
          fresh: useFresh,
          lean: true,
        })
        if (generation !== loadGenerationRef.current) return
        setContext(lean)
        setMode(lean.mode)
        setFocusId(lean.focusId)
        setIsLoading(false)
        writeCommandCenterContextCache(userId, mode, focusId, historySessionId, lean)

        const full = await fetchCommandCenterContext(mode, focusId, historySessionId, {
          fresh: false,
          lean: false,
        })
        if (generation !== loadGenerationRef.current) return
        setContext(full)
        setMode(full.mode)
        setFocusId(full.focusId)
        writeCommandCenterContextCache(userId, mode, focusId, historySessionId, full)
      } catch (err) {
        if (generation !== loadGenerationRef.current) return
        if (!contextRef.current) {
          setError(err instanceof Error ? err.message : "Failed to load AI context")
        }
        setIsLoading(false)
      }
    },
    [userId, mode, focusId, historySessionId],
  )

  const refresh = useCallback(async () => {
    await loadContext({ showLoading: !contextRef.current })
  }, [loadContext])

  useEffect(() => {
    if (!userId) {
      setContext(null)
      contextRef.current = null
      return
    }
    if (!sessionRestored || !isOpen) return
    void loadContext({ showLoading: !contextRef.current })
  }, [userId, mode, focusId, historySessionId, sessionRestored, isOpen, loadContext])

  /** Warm lean context while panel is closed so open feels instant. */
  useEffect(() => {
    if (!userId || isOpen) return
    const timer = window.setTimeout(() => {
      void fetchCommandCenterContext("companion", null, null, { lean: true })
        .then((lean) => {
          writeCommandCenterContextCache(userId, "companion", null, null, lean)
        })
        .catch(() => undefined)
    }, 3500)
    return () => window.clearTimeout(timer)
  }, [userId, isOpen, refreshKey])

  useEffect(() => {
    if (!userId) return
    void import("@/components/command-center/vyronis-command-center")
  }, [userId])

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = sessionStorage.getItem(OPEN_STATE_KEY)
    const storedFocus = sessionStorage.getItem(FOCUS_STATE_KEY)
    if (stored === "1" && userId) {
      setIsOpen(true)
    }
    if (storedFocus) {
      try {
        const parsed = JSON.parse(storedFocus) as {
          mode?: CommandCenterMode
          focusId?: string | null
          coachSessionId?: string | null
        }
        if (parsed.mode) setMode(parsed.mode)
        if (parsed.focusId !== undefined) setFocusId(parsed.focusId)
        if (parsed.coachSessionId) setCoachSessionId(parsed.coachSessionId)
      } catch {
        // ignore corrupt session payload
      }
    } else {
      const storedMode = sessionStorage.getItem(MODE_STATE_KEY) as CommandCenterMode | null
      if (storedMode) setMode(storedMode)
    }
    setSessionRestored(true)
  }, [userId])

  useEffect(() => {
    if (!userId || mode !== "pre_trade" || !focusId) return
    if (coachPreloadedSession?.id === focusId) return
    void fetchCoachSession(focusId)
      .then((session) => {
        coachSessionCacheRef.current.set(session.id, session)
        setCoachPreloadedSession(session)
        setCoachPlannedContext(session.planned_context)
      })
      .catch(() => undefined)
  }, [userId, mode, focusId, coachPreloadedSession?.id])

  useEffect(() => {
    if (typeof window === "undefined") return
    sessionStorage.setItem(OPEN_STATE_KEY, isOpen ? "1" : "0")
    sessionStorage.setItem(MODE_STATE_KEY, mode)
    sessionStorage.setItem(
      FOCUS_STATE_KEY,
      JSON.stringify({ mode, focusId, coachSessionId }),
    )
  }, [isOpen, mode, focusId, coachSessionId])

  const open = useCallback(
    (nextMode: CommandCenterMode = "companion") => {
      setHistorySessionId(null)
      needsFreshSessionRef.current = nextMode === "companion"
      setError(null)
      if (nextMode === "companion") {
        setMode("companion")
        setFocusId(null)
      }

      if (userId) {
        const cached = readCommandCenterContextCache(userId, nextMode, null, null)
        if (cached) {
          setContext(cached)
          setIsLoading(false)
        } else if (!contextRef.current) {
          setIsLoading(true)
        }
      }

      setIsOpen(true)
    },
    [userId],
  )

  const close = useCallback(async () => {
    panelEpochRef.current += 1
    const shouldArchive = userId && !historySessionId
    needsFreshSessionRef.current = true

    setIsOpen(false)
    setContext(null)
    setMode("companion")
    setFocusId(null)
    setHistorySessionId(null)
    setCoachSessionId(null)
    setCoachPlannedContext(buildEmptyPlannedContext())
    setStreamingMessage(null)
    setThinkingPhases([])
    setIsThinking(false)
    setIsSending(false)
    setIsTransitioning(false)
    setIsLoading(false)
    setError(null)

    if (typeof window !== "undefined") {
      sessionStorage.setItem(OPEN_STATE_KEY, "0")
      sessionStorage.setItem(MODE_STATE_KEY, "companion")
      sessionStorage.removeItem(FOCUS_STATE_KEY)
    }

    if (shouldArchive) {
      try {
        await archiveCommandCenterSession()
      } catch {
        // fresh=1 on next open will retry rotation
      }
    }
  }, [userId, historySessionId])

  const openHistorySession = useCallback(
    async (sessionId: string) => {
      if (!userId) return
      needsFreshSessionRef.current = false
      setHistorySessionId(sessionId)
      setMode("companion")
      setFocusId(null)
      setStreamingMessage(null)
      setContext(null)
      setIsLoading(true)
      setError(null)
      try {
        const next = await fetchCommandCenterContext("companion", null, sessionId)
        setContext(next)
        setMode(next.mode)
        setFocusId(next.focusId)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load session")
        setHistorySessionId(null)
      } finally {
        setIsLoading(false)
      }
    },
    [userId],
  )

  const startNewSession = useCallback(async () => {
    setHistorySessionId(null)
    setStreamingMessage(null)
    setError(null)
    if (!isOpen || !userId) return
    setIsLoading(true)
    try {
      const next = await fetchCommandCenterContext("companion", null, null, { fresh: true })
      setContext(next)
      setMode(next.mode)
      setFocusId(next.focusId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start new session")
    } finally {
      setIsLoading(false)
    }
  }, [isOpen, userId])

  const openPreTradeCoach = useCallback(
    async (options: OpenPreTradeOptions = {}) => {
      if (!userId) return
      setHistorySessionId(null)
      preTradeOpenInFlightRef.current = true
      setIsTransitioning(true)
      setError(null)

      let sessionId = options.sessionId ?? null
      if (sessionId) {
        setCoachPreloadedSession(
          coachSessionCacheRef.current.get(sessionId) ?? null,
        )
      } else {
        setCoachPreloadedSession(null)
        lastCoachContextFetchIdRef.current = null
      }

      let plannedContext = {
        ...(options.plannedContext ?? buildEmptyPlannedContext()),
        max_risk_per_trade: maxRiskPerTrade,
      }

      const label = plannedContext.pair
        ? `Pre-trade · ${plannedContext.pair} ${plannedContext.direction || ""}`.trim()
        : "Pre-trade coach"

      const openShell = (preload: TradeCoachSessionWithMessages | null) => {
        setCoachPlannedContext(plannedContext)
        setCoachSessionId(sessionId)
        setCoachPreloadedSession(preload)
        setMode("pre_trade")
        setFocusId(sessionId)
        setIsOpen(true)
        setIsTransitioning(false)
      }

      try {
        if (!sessionId) {
          const rules = await fetchTradingRulesSnapshot()
          if (rules && !rules.canOpenPreTradeCoach) {
            toast({
              title: "Trading blocked",
              description: rules.blockReason ?? "Complete Cooldown Coach before opening Coach.",
              variant: "destructive",
            })
            setIsTransitioning(false)
            preTradeOpenInFlightRef.current = false
            return
          }
        }

        if (sessionId) {
          const cached = coachSessionCacheRef.current.get(sessionId) ?? null
          if (cached) {
            plannedContext = {
              ...cached.planned_context,
              max_risk_per_trade: maxRiskPerTrade,
            }
          }
          openShell(cached)

          void (async () => {
            try {
              const session =
                cached ?? (await fetchCoachSession(sessionId!))
              coachSessionCacheRef.current.set(session.id, session)
              plannedContext = {
                ...session.planned_context,
                max_risk_per_trade: maxRiskPerTrade,
              }
              setCoachPlannedContext(plannedContext)
              setCoachPreloadedSession(session)

              const next = await switchCommandCenterMode({
                mode: "pre_trade",
                focusId: sessionId,
                label,
                direction: "enter",
              })
              setContext(next)
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not open pre-trade coach")
            } finally {
              preTradeOpenInFlightRef.current = false
            }
          })()
          return
        }

        let gate = await checkCoachReadiness(plannedContext.pair)
        if (options.plannerCheckIn) {
          gate = applyPlannerCoachGateSoftening(gate, plannedContext)
        }
        if (!gate.allowed) {
          setError(`${gate.headline} — ${gate.message}`)
          toast({
            title: gate.headline,
            description: gate.message,
            variant: "destructive",
          })
          setIsTransitioning(false)
          preTradeOpenInFlightRef.current = false
          return
        }
        if (gate.severity === "warning") {
          toast({
            title: gate.headline,
            description: gate.message,
          })
        }
        if (gate.pairPlan) {
          plannedContext = {
            ...buildPlannedContextFromPairPlan(gate.pairPlan),
            ...plannedContext,
            pair: gate.pairPlan.pair,
            max_risk_per_trade: maxRiskPerTrade,
          }
        }

        openShell(null)

        const next = await switchCommandCenterMode({
          mode: "pre_trade",
          focusId: sessionId,
          label,
          direction: "enter",
        })
        setContext(next)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not open pre-trade coach")
      } finally {
        if (!sessionId) {
          preTradeOpenInFlightRef.current = false
          setIsTransitioning(false)
        }
      }
    },
    [userId, maxRiskPerTrade, toast],
  )

  const returnToCompanion = useCallback(async () => {
    if (!userId) return
    setIsTransitioning(true)
    setError(null)

    try {
      const label = coachPlannedContext.pair
        ? `${coachPlannedContext.pair} review complete`
        : "Pre-trade session"

      const next = await switchCommandCenterMode({
        mode: "companion",
        direction: "exit",
        label,
      })

      setContext(next)
      setMode("companion")
      setFocusId(null)
      setCoachSessionId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not return to companion")
    } finally {
      setIsTransitioning(false)
    }
  }, [userId, coachPlannedContext.pair])

  const sendMessage = useCallback(
    async (input: {
      content: string
      imageUrl?: string | null
      imageUrls?: string[] | null
    }) => {
      if (!userId || historySessionId) return
      setIsSending(true)
      setIsThinking(true)
      setStreamingMessage(null)
      setError(null)

      const bundleUrls =
        input.imageUrls?.filter(Boolean) ??
        (input.imageUrl ? [input.imageUrl] : [])
      const isBundle = bundleUrls.length > 1
      const previewText =
        input.content.trim() ||
        (isBundle
          ? `📷 ${bundleUrls.length} chart screenshots (timeframe bundle)`
          : bundleUrls.length === 1
            ? "📷 Chart uploaded"
            : "")
      const previewState = context?.companionState ?? "calm"
      setThinkingPhases(
        isBundle
          ? [
              "Analyzing timeframe bundle…",
              "Reading timeframe labels on each chart…",
              "Comparing Weekly → Daily → H4 → H1 → M15 → M5…",
              "Checking HTF alignment and entry timing…",
            ]
          : bundleUrls.length === 1
            ? [
                "Reading your chart…",
                "Checking trend direction…",
                "Reviewing confirmation and structure…",
                "Putting the analysis together…",
              ]
            : buildThinkingPhases({ userMessage: previewText, state: previewState }),
      )

      const optimisticUser: CommandCenterMessageRecord = {
        id: `temp-${Date.now()}`,
        thread_id: context?.companionThreadId ?? context?.threadId ?? "",
        role: "user",
        message_type: bundleUrls.length > 0 ? "analysis" : "text",
        content: previewText,
        payload:
          bundleUrls.length > 0
            ? {
                imageUrl: bundleUrls[0],
                imageUrls: bundleUrls,
                analysisKind: isBundle ? "timeframe_bundle" : "single_chart",
              }
            : {},
        created_at: new Date().toISOString(),
      }

      const epoch = panelEpochRef.current
      setContext((prev) =>
        prev ? { ...prev, messages: [...prev.messages, optimisticUser] } : prev,
      )

      try {
        const result = await sendCommandCenterChat({
          content: input.content,
          imageUrl: input.imageUrl ?? bundleUrls[0] ?? null,
          imageUrls: isBundle ? bundleUrls : null,
          mode,
          focusId,
        })
        if (epoch !== panelEpochRef.current) return
        setThinkingPhases(result.thinkingPhases)
        setContext(result.context)
        setMode(result.context.mode)
        setFocusId(result.context.focusId)
        const stream = result.assistantMessage
        const alreadyVisible = result.context.messages.some(
          (message) =>
            message.id === stream.id ||
            (message.role === "assistant" &&
              stream.role === "assistant" &&
              message.content.trim() === stream.content.trim()),
        )
        setStreamingMessage(alreadyVisible ? null : stream)
      } catch (err) {
        if (epoch !== panelEpochRef.current) return
        setError(err instanceof Error ? err.message : "Failed to send message")
        void refresh()
      } finally {
        if (epoch === panelEpochRef.current) {
          setIsSending(false)
          setIsThinking(false)
        }
      }
    },
    [context, focusId, historySessionId, mode, refresh, userId],
  )

  const clearStreamingMessage = useCallback(() => {
    setStreamingMessage(null)
  }, [])

  const handleCoachSessionChange = useCallback(
    (sessionId: string | null) => {
      setCoachSessionId(sessionId)
      if (sessionId) {
        setFocusId(sessionId)
        if (
          userId &&
          mode === "pre_trade" &&
          lastCoachContextFetchIdRef.current !== sessionId
        ) {
          lastCoachContextFetchIdRef.current = sessionId
          void fetchCommandCenterContext("pre_trade", sessionId)
            .then(setContext)
            .catch(() => undefined)
        }
      }
      onCoachSessionChange?.(sessionId)
    },
    [mode, onCoachSessionChange, userId],
  )

  const handleCoachCompleted = useCallback(
    (sessionId: string) => {
      setCoachSessionId(sessionId)
      setFocusId(sessionId)
      onCoachCompleted?.(sessionId)
    },
    [onCoachCompleted],
  )

  const logPlannedTrade = useCallback(
    (sessionId: string) => {
      onLogPlannedTrade?.(sessionId)
    },
    [onLogPlannedTrade],
  )

  const handleCoachSessionLoaded = useCallback((session: TradeCoachSessionWithMessages) => {
    coachSessionCacheRef.current.set(session.id, session)
    setCoachPreloadedSession(session)
    setCoachPlannedContext(session.planned_context)
  }, [])

  const value = useMemo<AIContextValue>(
    () => ({
      enabled,
      isOpen,
      isLoading,
      isSending,
      isThinking,
      thinkingPhases,
      streamingMessage,
      isTransitioning,
      error,
      mode,
      focusId,
      context,
      coachSessionId,
      coachPlannedContext,
      coachPreloadedSession,
      maxRiskPerTrade,
      open,
      close,
      openPreTradeCoach,
      returnToCompanion,
      refresh,
      sendMessage,
      clearStreamingMessage,
      handleCoachSessionChange,
      handleCoachSessionLoaded,
      handleCoachCompleted,
      logPlannedTrade,
      historySessionId,
      viewingArchivedSession,
      openHistorySession,
      startNewSession,
    }),
    [
      enabled,
      isOpen,
      isLoading,
      isSending,
      isThinking,
      thinkingPhases,
      streamingMessage,
      isTransitioning,
      error,
      mode,
      focusId,
      context,
      coachSessionId,
      coachPlannedContext,
      coachPreloadedSession,
      maxRiskPerTrade,
      open,
      close,
      openPreTradeCoach,
      returnToCompanion,
      refresh,
      sendMessage,
      clearStreamingMessage,
      handleCoachSessionChange,
      handleCoachSessionLoaded,
      handleCoachCompleted,
      logPlannedTrade,
      historySessionId,
      viewingArchivedSession,
      openHistorySession,
      startNewSession,
    ],
  )

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>
}

export function useAIContext(): AIContextValue {
  const ctx = useContext(AIContext)
  if (!ctx) {
    throw new Error("useAIContext must be used within AIContextProvider")
  }
  return ctx
}

export function useOptionalAIContext(): AIContextValue | null {
  return useContext(AIContext)
}
