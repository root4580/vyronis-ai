"use client"

import { useEffect } from "react"
import { useAIContext } from "@/providers/ai-context-provider"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

type OpenPreTradeOptions = {
  sessionId?: string
  plannedContext?: PreTradePlannedContext
  plannerCheckIn?: boolean
}

type CommandCenterBridgeProps = {
  onBindOpen: (open: () => void) => void
  onBindPreTrade: (openPreTrade: (options?: OpenPreTradeOptions) => Promise<void>) => void
  onCoachSessionIdChange?: (sessionId: string | null) => void
}

export function CommandCenterBridge({
  onBindOpen,
  onBindPreTrade,
  onCoachSessionIdChange,
}: CommandCenterBridgeProps) {
  const { open, openPreTradeCoach, coachSessionId } = useAIContext()

  useEffect(() => {
    onBindOpen(() => open())
  }, [open, onBindOpen])

  useEffect(() => {
    onBindPreTrade(openPreTradeCoach)
  }, [openPreTradeCoach, onBindPreTrade])

  useEffect(() => {
    onCoachSessionIdChange?.(coachSessionId)
  }, [coachSessionId, onCoachSessionIdChange])

  return null
}
