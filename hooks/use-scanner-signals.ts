"use client"

import { useCallback, useEffect, useState } from "react"
import type { ScannerLiveSignal } from "@/lib/scanner/signal-types"
import { MOCK_LIVE_SIGNALS } from "@/lib/scanner/mock-data"

type ScannerSignalsState = {
  signals: ScannerLiveSignal[]
  loading: boolean
  source: "live" | "mock"
  tableMissing: boolean
  removingId: string | null
}

export function useScannerSignals(): ScannerSignalsState & {
  refetch: () => void
  removeSignal: (id: string) => Promise<{ ok: boolean; error?: string }>
} {
  const [signals, setSignals] = useState<ScannerLiveSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<"live" | "mock">("live")
  const [tableMissing, setTableMissing] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

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

  const removeSignal = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      if (source !== "live") {
        return { ok: false, error: "Remove is only available for live MT5 signals." }
      }

      setRemovingId(id)
      try {
        const res = await fetch("/api/scanner/signals/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ signalId: id }),
        })
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          return { ok: false, error: body.error ?? "Could not remove signal." }
        }
        setSignals((prev) => prev.filter((s) => s.id !== id))
        return { ok: true }
      } catch {
        return { ok: false, error: "Network error — try again." }
      } finally {
        setRemovingId(null)
      }
    },
    [source],
  )

  useEffect(() => {
    void fetchSignals()
    const interval = setInterval(() => void fetchSignals(), 60_000)
    return () => clearInterval(interval)
  }, [fetchSignals])

  return { signals, loading, source, tableMissing, removingId, refetch: fetchSignals, removeSignal }
}

export const DEFAULT_SELECTED_SIGNAL_ID = ""
