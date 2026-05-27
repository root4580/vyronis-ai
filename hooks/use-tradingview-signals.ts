"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fetchTradingViewSignals,
  markAllTradingViewSignalsRead,
  markTradingViewSignalRead,
} from "@/lib/tradingview/api-client"
import type { TradingViewSignalListItem } from "@/lib/tradingview/types"

const POLL_MS = 30_000

export function useTradingViewSignals(enabled = true) {
  const [signals, setSignals] = useState<TradingViewSignalListItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setIsLoading(true)
    try {
      const result = await fetchTradingViewSignals({ limit: 12 })
      setSignals(result.signals)
      setUnreadCount(result.unreadCount)
    } catch {
      setSignals([])
      setUnreadCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
    if (!enabled) return
    const interval = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(interval)
  }, [enabled, refresh])

  const markRead = useCallback(
    async (signalId: string) => {
      await markTradingViewSignalRead(signalId)
      await refresh()
    },
    [refresh],
  )

  const markAllRead = useCallback(async () => {
    await markAllTradingViewSignalsRead()
    await refresh()
  }, [refresh])

  return { signals, unreadCount, isLoading, refresh, markRead, markAllRead }
}
