import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import { countTradesThisWeek } from "@/lib/user-settings"

export const POSITIVE_SESSION_MOODS = new Set(["calm", "confident", "disciplined"])

export function todaySessionMood(context: FullTraderContext): string {
  return context.activePlannedContext?.emotion?.trim().toLowerCase() ?? ""
}

export function isCleanWeekWithPositiveMood(context: FullTraderContext): boolean {
  return (
    countTradesThisWeek(context.recentTrades) === 0 &&
    POSITIVE_SESSION_MOODS.has(todaySessionMood(context))
  )
}
