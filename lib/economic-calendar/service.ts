import { formatCalendarError } from "@/lib/economic-calendar/calendar-errors"
import { fetchForexFactoryCalendarWeek } from "@/lib/economic-calendar/faireconomy-client"
import { normalizeForexFactoryEvents } from "@/lib/economic-calendar/normalize"
import { refreshCalendarMinutes } from "@/lib/economic-calendar/refresh-snapshot"
import type { TodayCalendarResponse } from "@/lib/economic-calendar/types"

export { refreshCalendarMinutes, getUpcomingHighImpactWithin } from "@/lib/economic-calendar/refresh-snapshot"

type CacheEntry = {
  expiresAtMs: number
  staleUntilMs: number
  payload: TodayCalendarResponse
}

let calendarCache: CacheEntry | null = null
const CACHE_TTL_MS = 15 * 60_000
const STALE_CACHE_TTL_MS = 24 * 60 * 60_000

function emptyResponse(setupMessage: string | null): TodayCalendarResponse {
  return {
    connected: false,
    fetchedAt: new Date().toISOString(),
    setupMessage,
    stale: false,
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
        stale: false,
        events,
        nextHighImpact: null,
        nextEvent: null,
        safeToPairs: [],
      },
      now,
    )

    calendarCache = {
      expiresAtMs: now.getTime() + CACHE_TTL_MS,
      staleUntilMs: now.getTime() + STALE_CACHE_TTL_MS,
      payload,
    }

    return payload
  } catch (error) {
    if (calendarCache && calendarCache.staleUntilMs > now.getTime()) {
      return refreshCalendarMinutes(
        {
          ...calendarCache.payload,
          connected: true,
          stale: true,
          setupMessage: formatCalendarError(error),
        },
        now,
      )
    }

    return emptyResponse(formatCalendarError(error))
  }
}
