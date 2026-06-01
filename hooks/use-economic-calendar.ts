"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchTodayCalendar } from "@/lib/economic-calendar/api-client"
import { refreshCalendarMinutes } from "@/lib/economic-calendar/refresh-snapshot"
import type { TodayCalendarResponse } from "@/lib/economic-calendar/types"

const EMPTY_CALENDAR: TodayCalendarResponse = {
  connected: false,
  fetchedAt: new Date().toISOString(),
  setupMessage: null,
  events: [],
  nextHighImpact: null,
  safeToPairs: [],
}

export function useEconomicCalendar(options?: { refreshMs?: number }) {
  const refreshMs = options?.refreshMs ?? 60_000
  const [calendar, setCalendar] = useState<TodayCalendarResponse>(EMPTY_CALENDAR)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const snapshot = await fetchTodayCalendar()
      setCalendar(snapshot)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar")
      setCalendar(EMPTY_CALENDAR)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCalendar((current) => refreshCalendarMinutes(current))
    }, refreshMs)
    return () => window.clearInterval(timer)
  }, [refreshMs])

  return { calendar, loading, error, reload }
}
