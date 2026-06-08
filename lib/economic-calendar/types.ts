export type CalendarImpact = "high" | "medium" | "low"

export type EconomicCalendarEvent = {
  time: string
  currency: string
  event: string
  impact: CalendarImpact
  minutesUntil: number
  avoidPairs: string[]
  forecast: string | null
  previous: string | null
  actual: string | null
  /** ISO timestamp for sorting and countdown refresh. */
  dateUtc: string
}

export type CalendarNextHighImpact = {
  time: string
  minutesUntil: number
  currency: string
  event: string
  dateUtc: string
  impact: CalendarImpact
}

export type CalendarNextEvent = CalendarNextHighImpact

export type TodayCalendarResponse = {
  connected: boolean
  fetchedAt: string
  setupMessage?: string | null
  /** True when serving a cached snapshot because the upstream feed failed. */
  stale?: boolean
  events: EconomicCalendarEvent[]
  nextHighImpact: CalendarNextHighImpact | null
  nextEvent: CalendarNextEvent | null
  safeToPairs: string[]
}
