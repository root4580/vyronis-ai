"use client"

import { useCallback, useEffect, useState } from "react"
import {
  deleteTradingViewSignal,
  fetchTradingViewSignals,
  markAllTradingViewSignalsRead,
  markTradingViewSignalRead,
} from "@/lib/tradingview/api-client"
import type { TradingViewSignalListItem } from "@/lib/tradingview/types"
import { TRADINGVIEW_SIGNALS_REFRESH_EVENT } from "@/lib/tradingview/signals-events"

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
    const onSignalsRefresh = () => void refresh()
    window.addEventListener(TRADINGVIEW_SIGNALS_REFRESH_EVENT, onSignalsRefresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener(TRADINGVIEW_SIGNALS_REFRESH_EVENT, onSignalsRefresh)
    }
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

  const removeSignal = useCallback(
    async (signalId: string) => {
      await deleteTradingViewSignal(signalId)
      setSignals((prev) => {
        const removed = prev.find((row) => row.id === signalId)
        if (removed && !removed.read_at) {
          setUnreadCount((count) => Math.max(0, count - 1))
        }
        return prev.filter((row) => row.id !== signalId)
      })
    },
    [],
  )

  return { signals, unreadCount, isLoading, refresh, markRead, markAllRead, removeSignal }
}
