import { minutesUntilEvent } from "@/lib/economic-calendar/normalize"
import { pairsAvoidingCurrency } from "@/lib/economic-calendar/pair-impact"
import type {
  CalendarNextEvent,
  CalendarNextHighImpact,
  EconomicCalendarEvent,
  TodayCalendarResponse,
} from "@/lib/economic-calendar/types"

function toNextHighImpact(next: EconomicCalendarEvent, now = new Date()): CalendarNextHighImpact {
  return {
    time: next.time,
    minutesUntil: minutesUntilEvent(next.dateUtc, now),
    currency: next.currency,
    event: next.event,
    dateUtc: next.dateUtc,
    impact: next.impact,
  }
}

function toNextEvent(next: EconomicCalendarEvent, now = new Date()): CalendarNextEvent {
  return toNextHighImpact(next, now)
}

function buildNextHighImpact(events: EconomicCalendarEvent[], now = new Date()): CalendarNextHighImpact | null {
  const upcoming = events
    .filter((event) => event.impact === "high" && minutesUntilEvent(event.dateUtc, now) >= 0)
    .sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime())

  const next = upcoming[0]
  if (!next) return null
  return toNextHighImpact(next, now)
}

function buildNextEvent(events: EconomicCalendarEvent[], now = new Date()): CalendarNextEvent | null {
  const upcoming = events
    .filter((event) => minutesUntilEvent(event.dateUtc, now) >= 0)
    .sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime())

  const next = upcoming[0]
  if (!next) return null
  return toNextEvent(next, now)
}

function buildSafeToPairs(events: EconomicCalendarEvent[], now = new Date()): string[] {
  const nextHigh = events
    .filter((event) => event.impact === "high" && minutesUntilEvent(event.dateUtc, now) >= 0)
    .sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime())[0]

  if (!nextHigh) return []
  return pairsAvoidingCurrency(nextHigh.currency)
}

/** Recompute rolling minutesUntil without refetching the calendar feed. Safe for client hooks. */
export function refreshCalendarMinutes(
  snapshot: TodayCalendarResponse,
  now = new Date(),
): TodayCalendarResponse {
  const events = snapshot.events.map((event) => ({
    ...event,
    minutesUntil: minutesUntilEvent(event.dateUtc, now),
  }))

  return {
    ...snapshot,
    events,
    nextHighImpact: buildNextHighImpact(events, now),
    nextEvent: buildNextEvent(events, now),
    safeToPairs: buildSafeToPairs(events, now),
  }
}

export function getUpcomingHighImpactWithin(
  snapshot: TodayCalendarResponse,
  minutes: number,
  now = new Date(),
): EconomicCalendarEvent[] {
  return snapshot.events.filter(
    (event) =>
      event.impact === "high" &&
      minutesUntilEvent(event.dateUtc, now) >= 0 &&
      minutesUntilEvent(event.dateUtc, now) <= minutes,
  )
}
