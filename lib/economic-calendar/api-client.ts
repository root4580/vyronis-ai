import type { TodayCalendarResponse } from "@/lib/economic-calendar/types"

let inflightFetch: Promise<TodayCalendarResponse> | null = null

export async function fetchTodayCalendar(): Promise<TodayCalendarResponse> {
  if (inflightFetch) return inflightFetch

  inflightFetch = (async () => {
    const response = await fetch("/api/calendar/today", {
      credentials: "same-origin",
      cache: "no-store",
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error || "Failed to load economic calendar")
    }

    return response.json() as Promise<TodayCalendarResponse>
  })()

  try {
    return await inflightFetch
  } finally {
    inflightFetch = null
  }
}
