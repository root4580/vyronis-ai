"use client"

import { useEffect, useState } from "react"
import { fetchTradeQualityAnalytics } from "@/lib/trade-coach/api-client"
import type { TradeQualityAnalytics } from "@/lib/trade-coach/trade-quality-analytics"

export function useTradeQualityAnalytics(refreshKey = 0) {
  const [analytics, setAnalytics] = useState<TradeQualityAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)

      try {
        const result = await fetchTradeQualityAnalytics()
        if (!cancelled) setAnalytics(result)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load quality analytics")
          setAnalytics(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return { analytics, isLoading, error }
}
