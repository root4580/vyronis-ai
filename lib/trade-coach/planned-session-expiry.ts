import { getWeekStartSunday } from "@/lib/strategy-brain/week-utils"

export type PlannedSessionExpiryRow = {
  id: string
  created_at: string
  planned_context?: {
    trade_date?: string | null
  } | null
}

/** Sunday-start forex week for a session (trade_date when set, else created_at). */
export function resolvePlannedSessionWeekStart(input: {
  trade_date?: string | null
  created_at: string
}): string {
  const tradeDate = input.trade_date?.trim().split("T")[0]
  if (tradeDate && /^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) {
    return getWeekStartSunday(new Date(`${tradeDate}T12:00:00`))
  }
  return getWeekStartSunday(new Date(input.created_at))
}

/** True when the session's trading week ended (we are in a later Sunday-start week). */
export function isPastTradingWeek(weekStart: string, referenceDate = new Date()): boolean {
  const currentWeekStart = getWeekStartSunday(referenceDate)
  return weekStart < currentWeekStart
}

export function plannedCoachSessionIdsToPurge(
  sessions: PlannedSessionExpiryRow[],
  referenceDate = new Date(),
): string[] {
  return sessions
    .filter((session) => {
      const weekStart = resolvePlannedSessionWeekStart({
        trade_date: session.planned_context?.trade_date ?? null,
        created_at: session.created_at,
      })
      return isPastTradingWeek(weekStart, referenceDate)
    })
    .map((session) => session.id)
}
