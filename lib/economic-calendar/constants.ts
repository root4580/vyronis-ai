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

/** FXStreet country codes → ISO currency. */
export const COUNTRY_TO_CURRENCY: Record<string, CalendarWatchlistCurrency> = {
  US: "USD",
  USA: "USD",
  EU: "EUR",
  EMU: "EUR",
  EZ: "EUR",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  AU: "AUD",
  AUS: "AUD",
  GB: "GBP",
  UK: "GBP",
  CH: "CHF",
  CHE: "CHF",
  NZ: "NZD",
  CA: "CAD",
  CAN: "CAD",
  JP: "JPY",
  JPN: "JPY",
}

export const CALENDAR_TIMEZONE = "America/New_York"

export const FXSTREET_TOKEN_URL = "https://authorization.fxstreet.com/v2/token"
export const FXSTREET_CALENDAR_BASE = "https://calendar-api.fxstreet.com/en/api/v1"
