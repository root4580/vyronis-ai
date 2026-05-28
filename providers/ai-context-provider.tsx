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
import {
  fetchCommandCenterContext,
  sendCommandCenterMessage,
} from "@/lib/command-center/api-client"
import type { CommandCenterContext, CommandCenterMode } from "@/lib/command-center/types"

const OPEN_STATE_KEY = "vyronis.commandCenter.open"

type AIContextProviderProps = {
  children: ReactNode
  userId?: string | null
  refreshKey?: number
  onContinuePlannedCoach: (sessionId: string) => void
  onNewPreTradeCoach: () => void
}

type AIContextValue = {
  enabled: boolean
  isOpen: boolean
  isLoading: boolean
  isSending: boolean
  error: string | null
  context: CommandCenterContext | null
  open: (mode?: CommandCenterMode) => void
  close: () => void
  refresh: () => Promise<void>
  sendMessage: (content: string) => Promise<void>
  onContinuePlannedCoach: (sessionId: string) => void
  onNewPreTradeCoach: () => void
}

const AIContext = createContext<AIContextValue | null>(null)

export function AIContextProvider({
  children,
  userId,
  refreshKey = 0,
  onContinuePlannedCoach,
  onNewPreTradeCoach,
}: AIContextProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [context, setContext] = useState<CommandCenterContext | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enabled = context?.enabled ?? true

  const refresh = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    setError(null)
    try {
      const next = await fetchCommandCenterContext("companion")
      setContext(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AI context")
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setContext(null)
      return
    }
    void refresh()
  }, [userId, refreshKey, refresh])

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = sessionStorage.getItem(OPEN_STATE_KEY)
    if (stored === "1" && userId) {
      setIsOpen(true)
    }
  }, [userId])

  useEffect(() => {
    if (typeof window === "undefined") return
    sessionStorage.setItem(OPEN_STATE_KEY, isOpen ? "1" : "0")
  }, [isOpen])

  const open = useCallback(
    (mode: CommandCenterMode = "companion") => {
      setIsOpen(true)
      if (!context && userId) {
        void refresh()
      } else if (context && context.mode !== mode) {
        void refresh()
      }
    },
    [context, refresh, userId],
  )

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!userId) return
      setIsSending(true)
      setError(null)

      const optimisticUser = {
        id: `temp-${Date.now()}`,
        thread_id: context?.threadId ?? "",
        role: "user" as const,
        message_type: "text" as const,
        content,
        payload: {},
        created_at: new Date().toISOString(),
      }

      setContext((prev) =>
        prev
          ? { ...prev, messages: [...prev.messages, optimisticUser] }
          : prev,
      )

      try {
        const result = await sendCommandCenterMessage(content)
        setContext(result.context)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message")
        void refresh()
      } finally {
        setIsSending(false)
      }
    },
    [context?.threadId, refresh, userId],
  )

  const value = useMemo<AIContextValue>(
    () => ({
      enabled,
      isOpen,
      isLoading,
      isSending,
      error,
      context,
      open,
      close,
      refresh,
      sendMessage,
      onContinuePlannedCoach,
      onNewPreTradeCoach,
    }),
    [
      enabled,
      isOpen,
      isLoading,
      isSending,
      error,
      context,
      open,
      close,
      refresh,
      sendMessage,
      onContinuePlannedCoach,
      onNewPreTradeCoach,
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
