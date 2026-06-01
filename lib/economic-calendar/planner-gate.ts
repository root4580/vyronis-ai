import { pairAffectedByUpcomingHighImpact } from "@/lib/economic-calendar/briefing-lines"
import type { TodayCalendarResponse } from "@/lib/economic-calendar/types"
import type { TradePlanCalculation, TradePlanWarning } from "@/lib/trade-planner/types"

const NEWS_WARNING_ID = "news_warning_30"
const NEWS_BLOCK_ID = "news_block_15"

export function buildPlannerNewsWarnings(input: {
  pair: string
  calendar: TodayCalendarResponse | null | undefined
}): TradePlanWarning[] {
  const warnings: TradePlanWarning[] = []
  const blockMatch = pairAffectedByUpcomingHighImpact(input.pair, input.calendar, 15)
  if (blockMatch) {
    warnings.push({
      id: NEWS_BLOCK_ID,
      message: `${blockMatch.event.currency} ${blockMatch.event.event} in ${blockMatch.minutesUntil} min — entry blocked until after release.`,
    })
    return warnings
  }

  const warnMatch = pairAffectedByUpcomingHighImpact(input.pair, input.calendar, 30)
  if (warnMatch) {
    warnings.push({
      id: NEWS_WARNING_ID,
      message: `High impact ${warnMatch.event.currency} news in ${warnMatch.minutesUntil} min — wait until after ${warnMatch.event.event}.`,
    })
  }

  return warnings
}

export function applyCalendarGateToPlan(
  plan: TradePlanCalculation,
  calendar: TodayCalendarResponse | null | undefined,
): TradePlanCalculation {
  const newsWarnings = buildPlannerNewsWarnings({ pair: plan.pair, calendar })
  if (newsWarnings.length === 0) return plan

  const warnings = [...plan.warnings, ...newsWarnings]
  const blocked = warnings.some((warning) => warning.id === NEWS_BLOCK_ID)

  if (blocked) {
    return {
      ...plan,
      warnings,
      suggestedAction: "skip_plan",
      suggestedActionLabel: "Skip — high impact news too close for entry.",
    }
  }

  if (plan.suggestedAction === "plan_valid") {
    return {
      ...plan,
      warnings,
      suggestedAction: "adjust_plan",
      suggestedActionLabel: "Adjust plan — high impact news approaching.",
    }
  }

  return { ...plan, warnings }
}

export function isPlannerNewsBlocked(warnings: TradePlanWarning[]): boolean {
  return warnings.some((warning) => warning.id === NEWS_BLOCK_ID)
}
