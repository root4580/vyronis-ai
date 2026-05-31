import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import { fetchMarketBias, fetchWeeklyPlan } from "@/lib/strategy-brain/api-client"
import {
  biasAlignsWithPair,
  evaluateMarketBias,
} from "@/lib/strategy-brain/market-bias-engine"
import {
  evaluateWeeklyWatchlistGate,
  type WeeklyWatchlistGateResult,
  type WeeklyWatchlistGateSeverity,
} from "@/lib/strategy-brain/weekly-watchlist"

export type CoachReadinessResult = WeeklyWatchlistGateResult & {
  biasReady: boolean
  biasNote: string | null
}

function mergeSeverity(
  a: WeeklyWatchlistGateSeverity,
  b: WeeklyWatchlistGateSeverity,
): WeeklyWatchlistGateSeverity {
  if (a === "blocked" || b === "blocked") return "blocked"
  if (a === "warning" || b === "warning") return "warning"
  return "ok"
}

export function hasTradePlannerCoachLevels(context: PreTradePlannedContext): boolean {
  return (
    Boolean(context.pair?.trim()) &&
    Boolean(context.entry_price?.trim()) &&
    Boolean(context.stop_loss?.trim()) &&
    Boolean(context.take_profit?.trim())
  )
}

/** Trade Planner check-ins already have entry/SL/TP — warn on War Room gaps, don't hard-block. */
export function applyPlannerCoachGateSoftening(
  gate: CoachReadinessResult,
  plannedContext: PreTradePlannedContext,
): CoachReadinessResult {
  if (!hasTradePlannerCoachLevels(plannedContext) || gate.allowed) {
    return gate
  }

  return {
    ...gate,
    allowed: true,
    severity: "warning",
    message: `${gate.message} Coach opened with your Trade Planner levels — complete War Room when you can.`,
  }
}

export async function checkCoachReadiness(
  pair?: string | null,
): Promise<CoachReadinessResult> {
  const [weekPlan, biasRecord] = await Promise.all([
    fetchWeeklyPlan().catch(() => null),
    fetchMarketBias().catch(() => null),
  ])

  const watchlist = evaluateWeeklyWatchlistGate({
    pair: pair ?? undefined,
    weekPlan,
  })

  let allowed = watchlist.allowed
  let severity = watchlist.severity
  let headline = watchlist.headline
  let message = watchlist.message
  let biasReady = true
  let biasNote: string | null = null

  if (!watchlist.allowed) {
    return { ...watchlist, biasReady: false, biasNote: null }
  }

  if (!biasRecord) {
    biasReady = false
    biasNote = "Set Weekly, Daily, and H4 bias in War Room before sizing up."
    if (watchlist.watchlistComplete) {
      severity = mergeSeverity(severity, "warning")
      headline = severity === "warning" && headline === "Watchlist active" ? "HTF bias missing" : headline
      message = [message, biasNote].filter(Boolean).join(" ")
    }
  } else {
    const market = evaluateMarketBias({
      weekly_bias: biasRecord.weekly_bias,
      daily_bias: biasRecord.daily_bias,
      h4_bias: biasRecord.h4_bias,
    })
    biasReady = market.directional_permission && market.setup_valid

    if (!market.setup_valid) {
      biasNote = market.conflict_summary ?? market.alignment_summary
      severity = mergeSeverity(severity, "warning")
      headline = "HTF bias conflict"
      message = [watchlist.message, biasNote].filter(Boolean).join(" ")
    } else if (!market.directional_permission) {
      biasNote = market.alignment_summary
      severity = mergeSeverity(severity, "warning")
      if (severity === "warning" && headline === "Watchlist active") {
        headline = "HTF alignment forming"
      }
      message = [watchlist.message, biasNote].filter(Boolean).join(" ")
    }

    const pairPlan = watchlist.pairPlan
    if (
      pairPlan?.directional_bias &&
      pairPlan.directional_bias !== "Neutral" &&
      !biasAlignsWithPair(market, pairPlan.directional_bias)
    ) {
      const alignNote = `${pairPlan.pair} is ${pairPlan.directional_bias}; HTF market bias is not aligned yet — trade smaller or wait.`
      biasNote = alignNote
      severity = mergeSeverity(severity, "warning")
      headline = "Pair vs HTF bias"
      message = [watchlist.message, alignNote].filter(Boolean).join(" ")
    }
  }

  return {
    ...watchlist,
    allowed,
    severity,
    headline,
    message,
    biasReady,
    biasNote,
  }
}
