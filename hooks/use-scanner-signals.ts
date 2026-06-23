"use client"

import { useCallback, useEffect, useState } from "react"
import type { ScannerLiveSignal } from "@/lib/scanner/signal-types"
import { MOCK_LIVE_SIGNALS } from "@/lib/scanner/mock-data"

type ScannerSignalsState = {
  signals: ScannerLiveSignal[]
  loading: boolean
  source: "live" | "mock"
  tableMissing: boolean
}

export function useScannerSignals(): ScannerSignalsState & { refetch: () => void } {
  const [signals, setSignals] = useState<ScannerLiveSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<"live" | "mock">("live")
  const [tableMissing, setTableMissing] = useState(false)

  const fetchSignals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/scanner/signals", { cache: "no-store" })
      if (!res.ok) throw new Error("fetch failed")
      const data = (await res.json()) as {
        signals?: ScannerLiveSignal[]
        tableMissing?: boolean
      }

      if (data.tableMissing) {
        setTableMissing(true)
        setSignals(MOCK_LIVE_SIGNALS)
        setSource("mock")
        return
      }

      setTableMissing(false)
      setSignals(data.signals ?? [])
      setSource("live")
    } catch {
      setTableMissing(false)
      setSignals([])
      setSource("live")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSignals()
    const interval = setInterval(() => void fetchSignals(), 60_000)
    return () => clearInterval(interval)
  }, [fetchSignals])

  return { signals, loading, source, tableMissing, refetch: fetchSignals }
}

export const DEFAULT_SELECTED_SIGNAL_ID = ""
