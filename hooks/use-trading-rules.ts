"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  fetchTradingRulesSnapshot,
  syncTradingRulesCooldown,
} from "@/lib/trading-rules/api-client"
import type { TradingRulesSnapshot } from "@/lib/trading-rules/types"

type UseTradingRulesOptions = {
  accountId?: string | null
  enabled?: boolean
}

export function useTradingRules({ accountId, enabled = true }: UseTradingRulesOptions) {
  const [snapshot, setSnapshot] = useState<TradingRulesSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [cooldownModalOpen, setCooldownModalOpen] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled || !accountId) {
      setSnapshot(null)
      return null
    }

    setIsLoading(true)
    try {
      const next = await fetchTradingRulesSnapshot(accountId)
      setSnapshot(next)
      return next
    } catch {
      setSnapshot(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [accountId, enabled])

  const syncAfterTrade = useCallback(async () => {
    if (!accountId) return null
    try {
      const next = await syncTradingRulesCooldown(accountId)
      setSnapshot(next)
      return next
    } catch {
      return refresh()
    }
  }, [accountId, refresh])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const guardTradeAction = useCallback(
    (actionLabel = "trade"): boolean => {
      if (!snapshot) return true
      if (snapshot.canLogTrade) return true
      if (snapshot.cooldownRequired) {
        setCooldownModalOpen(true)
      }
      return false
    },
    [snapshot],
  )

  const blockMessage = useMemo(() => snapshot?.blockReason ?? null, [snapshot])

  return {
    snapshot,
    isLoading,
    refresh,
    syncAfterTrade,
    guardTradeAction,
    blockMessage,
    cooldownModalOpen,
    setCooldownModalOpen,
    canLogTrade: snapshot?.canLogTrade ?? true,
    canSavePlan: snapshot?.canSavePlan ?? true,
    canOpenPreTradeCoach: snapshot?.canOpenPreTradeCoach ?? true,
  }
}
