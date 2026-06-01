/** Currencies tracked in Vyronis economic calendar watchlist. */
export const CALENDAR_WATCHLIST_CURRENCIES = [
  "USD",
  "EUR",
  "AUD",
  "GBP",
  "CHF",
  "NZD",
  "CAD",
  "JPY",
] as const

export type CalendarWatchlistCurrency = (typeof CALENDAR_WATCHLIST_CURRENCIES)[number]

export const CALENDAR_TIMEZONE = "America/New_York"

/** Free ForexFactory weekly feed (no authentication). */
export const FOREX_FACTORY_CALENDAR_URL =
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
