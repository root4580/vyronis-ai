export type CalendarImpact = "high" | "medium"

export type EconomicCalendarEvent = {
  time: string
  currency: string
  event: string
  impact: CalendarImpact
  minutesUntil: number
  avoidPairs: string[]
  /** ISO timestamp for sorting and countdown refresh. */
  dateUtc: string
}

export type CalendarNextHighImpact = {
  time: string
  minutesUntil: number
  currency: string
  event: string
  dateUtc: string
}

export type TodayCalendarResponse = {
  connected: boolean
  fetchedAt: string
  setupMessage?: string | null
  events: EconomicCalendarEvent[]
  nextHighImpact: CalendarNextHighImpact | null
  safeToPairs: string[]
}
