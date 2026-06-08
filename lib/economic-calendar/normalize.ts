import {
  CALENDAR_TIMEZONE,
  CALENDAR_WATCHLIST_CURRENCIES,
  type CalendarWatchlistCurrency,
} from "@/lib/economic-calendar/constants"
import type { RawForexFactoryEvent } from "@/lib/economic-calendar/faireconomy-client"
import type { CalendarImpact, EconomicCalendarEvent } from "@/lib/economic-calendar/types"
import { pairsInvolvingCurrency } from "@/lib/economic-calendar/pair-impact"

function isWatchlistCurrency(value: string): value is CalendarWatchlistCurrency {
  const code = value.trim().toUpperCase()
  return CALENDAR_WATCHLIST_CURRENCIES.includes(code as CalendarWatchlistCurrency)
}

export function isSameCalendarDayInTimezone(
  isoDate: string,
  dayKey: string,
  timeZone = CALENDAR_TIMEZONE,
): boolean {
  const eventDay = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoDate))
  return eventDay === dayKey
}

export function formatCalendarTimeEt(dateIso: string): string {
  const date = new Date(dateIso)
  if (Number.isNaN(date.getTime())) return dateIso
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CALENDAR_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date)
}

export function formatCalendarTimeShort(dateIso: string): string {
  const date = new Date(dateIso)
  if (Number.isNaN(date.getTime())) return dateIso
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CALENDAR_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

export function parseCalendarImpact(raw: string | undefined | null): CalendarImpact | null {
  const value = raw?.trim().toLowerCase()
  if (value === "high") return "high"
  if (value === "medium") return "medium"
  if (value === "low") return "low"
  return null
}

export function minutesUntilEvent(dateIso: string, now = new Date()): number {
  const eventMs = new Date(dateIso).getTime()
  if (Number.isNaN(eventMs)) return Number.POSITIVE_INFINITY
  return Math.round((eventMs - now.getTime()) / 60_000)
}

export function formatCalendarDayLabel(dateIso: string, now = new Date()): string {
  const date = new Date(dateIso)
  if (Number.isNaN(date.getTime())) return dateIso
  const todayKey = formatCalendarDateEt(now)
  const eventKey = formatCalendarDateEt(date)
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: CALENDAR_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date)
  return todayKey === eventKey ? `Today: ${label}` : label
}

export function formatCalendarDateEt(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)

  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  if (!year || !month || !day) {
    return now.toISOString().slice(0, 10)
  }
  return `${year}-${month}-${day}`
}

export function normalizeForexFactoryEvents(
  rawEvents: RawForexFactoryEvent[],
  now = new Date(),
): EconomicCalendarEvent[] {
  const todayKey = formatCalendarDateEt(now)
  const normalized: EconomicCalendarEvent[] = []

  for (const raw of rawEvents) {
    const impact = parseCalendarImpact(raw.impact)
    if (!impact) continue

    const currency = raw.country?.trim().toUpperCase()
    if (!currency || !isWatchlistCurrency(currency)) continue

    const dateIso = raw.date?.trim()
    if (!dateIso || !isSameCalendarDayInTimezone(dateIso, todayKey)) continue

    const dateUtc = new Date(dateIso).toISOString()
    const minutesUntil = minutesUntilEvent(dateIso, now)

    normalized.push({
      time: formatCalendarTimeEt(dateIso),
      currency,
      event: raw.title?.trim() || "Economic release",
      impact,
      minutesUntil,
      avoidPairs: pairsInvolvingCurrency(currency),
      forecast: raw.forecast?.trim() || null,
      previous: raw.previous?.trim() || null,
      actual: raw.actual?.trim() || null,
      dateUtc,
    })
  }

  return normalized.sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime())
}
