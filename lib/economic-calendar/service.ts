import { fetchForexFactoryCalendarWeek } from "@/lib/economic-calendar/faireconomy-client"
import { normalizeForexFactoryEvents } from "@/lib/economic-calendar/normalize"
import { refreshCalendarMinutes } from "@/lib/economic-calendar/refresh-snapshot"
import type { TodayCalendarResponse } from "@/lib/economic-calendar/types"

export { refreshCalendarMinutes, getUpcomingHighImpactWithin } from "@/lib/economic-calendar/refresh-snapshot"

type CacheEntry = {
  expiresAtMs: number
  payload: TodayCalendarResponse
}

let calendarCache: CacheEntry | null = null
const CACHE_TTL_MS = 5 * 60_000

function emptyResponse(setupMessage: string | null): TodayCalendarResponse {
  return {
    connected: false,
    fetchedAt: new Date().toISOString(),
    setupMessage,
    events: [],
    nextHighImpact: null,
    nextEvent: null,
    safeToPairs: [],
  }
}

export async function getTodayCalendarSnapshot(now = new Date()): Promise<TodayCalendarResponse> {
  if (calendarCache && calendarCache.expiresAtMs > now.getTime()) {
    return refreshCalendarMinutes(calendarCache.payload, now)
  }

  try {
    const rawEvents = await fetchForexFactoryCalendarWeek()
    const events = normalizeForexFactoryEvents(rawEvents, now)
    const payload = refreshCalendarMinutes(
      {
        connected: true,
        fetchedAt: now.toISOString(),
        setupMessage: null,
        events,
        nextHighImpact: null,
        nextEvent: null,
        safeToPairs: [],
      },
      now,
    )

    calendarCache = {
      expiresAtMs: now.getTime() + CACHE_TTL_MS,
      payload,
    }

    return payload
  } catch (error) {
    return {
      ...emptyResponse(error instanceof Error ? error.message : "Failed to load economic calendar."),
      connected: false,
    }
  }
}
