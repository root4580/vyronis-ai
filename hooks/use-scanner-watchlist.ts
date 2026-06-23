"use client"

import { useCallback, useEffect, useState } from "react"
import type { ScannerWatchlistPair } from "@/lib/scanner/signal-types"
import { MOCK_WATCHLIST } from "@/lib/scanner/mock-data"

export type ScannerWatchlistStats = {
  totalScanned: number
  building: number
  waitingConfirmation: number
  activeSignals: number
}

type ScannerWatchlistState = {
  pairs: ScannerWatchlistPair[]
  stats: ScannerWatchlistStats
  loading: boolean
  source: "live" | "mock"
  tableMissing: boolean
}

const EMPTY_STATS: ScannerWatchlistStats = {
  totalScanned: 0,
  building: 0,
  waitingConfirmation: 0,
  activeSignals: 0,
}

export function useScannerWatchlist(): ScannerWatchlistState & { refetch: () => void } {
  const [pairs, setPairs] = useState<ScannerWatchlistPair[]>([])
  const [stats, setStats] = useState<ScannerWatchlistStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<"live" | "mock">("live")
  const [tableMissing, setTableMissing] = useState(false)

  const fetchWatchlist = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/scanner/watchlist", { cache: "no-store" })
      if (!res.ok) throw new Error("fetch failed")
      const data = (await res.json()) as {
        pairs?: ScannerWatchlistPair[]
        stats?: ScannerWatchlistStats
        tableMissing?: boolean
      }

      if (data.tableMissing) {
        setTableMissing(true)
        setPairs(MOCK_WATCHLIST)
        setStats({
          totalScanned: MOCK_WATCHLIST.length,
          building: 1,
          waitingConfirmation: 1,
          activeSignals: 1,
        })
        setSource("mock")
        return
      }

      setTableMissing(false)
      setPairs(data.pairs ?? [])
      setStats(data.stats ?? EMPTY_STATS)
      setSource("live")
    } catch {
      setTableMissing(false)
      setPairs([])
      setStats(EMPTY_STATS)
      setSource("live")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchWatchlist()
    const interval = setInterval(() => void fetchWatchlist(), 60_000)
    return () => clearInterval(interval)
  }, [fetchWatchlist])

  return { pairs, stats, loading, source, tableMissing, refetch: fetchWatchlist }
}
