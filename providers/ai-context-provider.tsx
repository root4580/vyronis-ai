"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { fetchCoachSession } from "@/lib/trade-coach/api-client"
import { buildEmptyPlannedContext } from "@/lib/trade-coach/planned-context"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import {
  fetchCommandCenterContext,
  sendCommandCenterChat,
  switchCommandCenterMode,
} from "@/lib/command-center/api-client"
import type { CommandCenterContext, CommandCenterMessageRecord, CommandCenterMode } from "@/lib/command-center/types"
import { buildThinkingPhases } from "@/lib/intelligence/conversational-state-engine"

const OPEN_STATE_KEY = "vyronis.commandCenter.open"
const MODE_STATE_KEY = "vyronis.commandCenter.mode"
const FOCUS_STATE_KEY = "vyronis.commandCenter.focus"

type OpenPreTradeOptions = {
  sessionId?: string
  plannedContext?: PreTradePlannedContext
}

type AIContextProviderProps = {
  children: ReactNode
  userId?: string | null
  refreshKey?: number
  maxRiskPerTrade?: number
  onCoachSessionChange?: (sessionId: string | null) => void
  onCoachCompleted?: (sessionId: string) => void
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
  maxRiskPerTrade: number
  open: (mode?: CommandCenterMode) => void
  close: () => void
  openPreTradeCoach: (options?: OpenPreTradeOptions) => Promise<void>
  returnToCompanion: () => Promise<void>
  refresh: () => Promise<void>
  sendMessage: (content: string) => Promise<void>
  clearStreamingMessage: () => void
  handleCoachSessionChange: (sessionId: string | null) => void
  handleCoachCompleted: (sessionId: string) => void
}

const AIContext = createContext<AIContextValue | null>(null)

export function AIContextProvider({
  children,
  userId,
  refreshKey = 0,
  maxRiskPerTrade = 1,
  onCoachSessionChange,
  onCoachCompleted,
}: AIContextProviderProps) {
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

  const enabled = context?.enabled ?? true

  const refresh = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    setError(null)
    try {
      const next = await fetchCommandCenterContext(mode, focusId)
      setContext(next)
      setMode(next.mode)
      setFocusId(next.focusId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AI context")
    } finally {
      setIsLoading(false)
    }
  }, [userId, mode, focusId])

  useEffect(() => {
    if (!userId) {
      setContext(null)
      return
    }
    if (!sessionRestored) return
    void refresh()
  }, [userId, refreshKey, mode, focusId, sessionRestored, refresh])

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
    void fetchCoachSession(focusId)
      .then((session) => setCoachPlannedContext(session.planned_context))
      .catch(() => undefined)
  }, [userId, mode, focusId])

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
      setIsOpen(true)
      if (nextMode === "companion") {
        setMode("companion")
        setFocusId(null)
      }
    },
    [],
  )

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const openPreTradeCoach = useCallback(
    async (options: OpenPreTradeOptions = {}) => {
      if (!userId) return
      setIsOpen(true)
      setIsTransitioning(true)
      setError(null)

      try {
        let sessionId = options.sessionId ?? null
        let plannedContext = options.plannedContext ?? buildEmptyPlannedContext()

        if (sessionId) {
          const session = await fetchCoachSession(sessionId)
          plannedContext = session.planned_context
        } else {
          plannedContext = {
            ...plannedContext,
            max_risk_per_trade: maxRiskPerTrade,
          }
          sessionId = null
        }

        setCoachPlannedContext(plannedContext)
        setCoachSessionId(sessionId)

        const label = plannedContext.pair
          ? `Pre-trade · ${plannedContext.pair} ${plannedContext.direction || ""}`.trim()
          : "Pre-trade coach"

        const next = await switchCommandCenterMode({
          mode: "pre_trade",
          focusId: sessionId,
          label,
          direction: "enter",
        })

        setContext(next)
        setMode("pre_trade")
        setFocusId(sessionId)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not open pre-trade coach")
      } finally {
        setIsTransitioning(false)
      }
    },
    [userId, maxRiskPerTrade],
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
    async (content: string) => {
      if (!userId) return
      setIsSending(true)
      setIsThinking(true)
      setStreamingMessage(null)
      setError(null)

      const previewState = context?.companionState ?? "calm"
      setThinkingPhases(buildThinkingPhases({ userMessage: content, state: previewState }))

      const optimisticUser = {
        id: `temp-${Date.now()}`,
        thread_id: context?.companionThreadId ?? context?.threadId ?? "",
        role: "user" as const,
        message_type: "text" as const,
        content,
        payload: {},
        created_at: new Date().toISOString(),
      }

      setContext((prev) =>
        prev ? { ...prev, messages: [...prev.messages, optimisticUser] } : prev,
      )

      try {
        const result = await sendCommandCenterChat({
          content,
          mode,
          focusId,
        })
        setThinkingPhases(result.thinkingPhases)
        setContext(result.context)
        setMode(result.context.mode)
        setFocusId(result.context.focusId)
        setStreamingMessage(result.assistantMessage)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message")
        void refresh()
      } finally {
        setIsSending(false)
        setIsThinking(false)
      }
    },
    [context, focusId, mode, refresh, userId],
  )

  const clearStreamingMessage = useCallback(() => {
    setStreamingMessage(null)
  }, [])

  const handleCoachSessionChange = useCallback(
    (sessionId: string | null) => {
      setCoachSessionId(sessionId)
      if (sessionId) {
        setFocusId(sessionId)
        if (userId && mode === "pre_trade") {
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
      maxRiskPerTrade,
      open,
      close,
      openPreTradeCoach,
      returnToCompanion,
      refresh,
      sendMessage,
      clearStreamingMessage,
      handleCoachSessionChange,
      handleCoachCompleted,
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
      maxRiskPerTrade,
      open,
      close,
      openPreTradeCoach,
      returnToCompanion,
      refresh,
      sendMessage,
      clearStreamingMessage,
      handleCoachSessionChange,
      handleCoachCompleted,
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
