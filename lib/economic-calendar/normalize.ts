import {
  CALENDAR_TIMEZONE,
  CALENDAR_WATCHLIST_CURRENCIES,
  COUNTRY_TO_CURRENCY,
  type CalendarWatchlistCurrency,
} from "@/lib/economic-calendar/constants"
import type { RawFxStreetEventDate } from "@/lib/economic-calendar/fxstreet-client"
import type { CalendarImpact, EconomicCalendarEvent } from "@/lib/economic-calendar/types"
import { pairsInvolvingCurrency } from "@/lib/economic-calendar/pair-impact"

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readNested(raw: RawFxStreetEventDate, key: string): Record<string, unknown> | null {
  const value = raw[key]
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function resolveEventCurrency(raw: RawFxStreetEventDate): CalendarWatchlistCurrency | null {
  const event = readNested(raw, "Event") ?? readNested(raw, "event")
  const candidates = [
    readString(raw.CurrencyCode),
    readString(raw.currencyCode),
    readString(raw.Currency),
    readString(event?.CurrencyCode),
    readString(event?.currencyCode),
    readString(event?.Currency),
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    const code = candidate.replace(/[^A-Za-z]/g, "").toUpperCase()
    if (CALENDAR_WATCHLIST_CURRENCIES.includes(code as CalendarWatchlistCurrency)) {
      return code as CalendarWatchlistCurrency
    }
  }

  const countryCandidates = [
    readString(raw.CountryCode),
    readString(raw.countryCode),
    readString(raw.Country),
    readString(event?.CountryCode),
    readString(event?.countryCode),
  ]

  for (const country of countryCandidates) {
    if (!country) continue
    const mapped = COUNTRY_TO_CURRENCY[country.toUpperCase()]
    if (mapped) return mapped
  }

  return null
}

export function resolveEventName(raw: RawFxStreetEventDate): string {
  const event = readNested(raw, "Event") ?? readNested(raw, "event")
  return (
    readString(raw.EventName) ??
    readString(raw.Name) ??
    readString(raw.name) ??
    readString(event?.Name) ??
    readString(event?.name) ??
    "Economic release"
  )
}

export function resolveEventDateUtc(raw: RawFxStreetEventDate): string | null {
  return readString(raw.DateUtc) ?? readString(raw.dateUtc) ?? readString(raw.Date)
}

/** FXStreet volatility: 0 none, 1 low, 2 medium, 3 high (also accepts string labels). */
export function mapEventImpact(raw: RawFxStreetEventDate): CalendarImpact | null {
  const volatility = raw.Volatility ?? raw.volatility ?? readNested(raw, "Event")?.Volatility
  if (typeof volatility === "string") {
    const label = volatility.toUpperCase()
    if (label === "HIGH") return "high"
    if (label === "MEDIUM") return "medium"
    return null
  }
  if (typeof volatility === "number") {
    if (volatility >= 3) return "high"
    if (volatility === 2) return "medium"
  }
  return null
}

export function formatCalendarTimeEt(dateUtc: string): string {
  const date = new Date(dateUtc)
  if (Number.isNaN(date.getTime())) return dateUtc
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CALENDAR_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date)
}

export function minutesUntilEvent(dateUtc: string, now = new Date()): number {
  const eventMs = new Date(dateUtc).getTime()
  if (Number.isNaN(eventMs)) return Number.POSITIVE_INFINITY
  return Math.round((eventMs - now.getTime()) / 60_000)
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

export function normalizeFxStreetEvents(
  rawEvents: RawFxStreetEventDate[],
  now = new Date(),
): EconomicCalendarEvent[] {
  const normalized: EconomicCalendarEvent[] = []

  for (const raw of rawEvents) {
    const impact = mapEventImpact(raw)
    if (!impact) continue

    const currency = resolveEventCurrency(raw)
    if (!currency) continue

    const dateUtc = resolveEventDateUtc(raw)
    if (!dateUtc) continue

    const minutesUntil = minutesUntilEvent(dateUtc, now)
    if (minutesUntil < -120) continue

    normalized.push({
      time: formatCalendarTimeEt(dateUtc),
      currency,
      event: resolveEventName(raw),
      impact,
      minutesUntil,
      avoidPairs: pairsInvolvingCurrency(currency),
      dateUtc,
    })
  }

  return normalized.sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime())
}
