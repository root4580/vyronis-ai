import type { PairPlanRecord, WeeklyPlanWithPairs } from "@/lib/strategy-brain/types"

/** At least one pair required; 3–5 is recommended for weekly focus discipline. */
export const WEEKLY_WATCHLIST_MIN = 1
export const WEEKLY_WATCHLIST_RECOMMENDED = 3
export const WEEKLY_WATCHLIST_MAX = 5

export type WeeklyWatchlistGateSeverity = "ok" | "warning" | "blocked"

export type WeeklyWatchlistGateResult = {
  allowed: boolean
  severity: WeeklyWatchlistGateSeverity
  headline: string
  message: string
  watchlistComplete: boolean
  pairCount: number
  pairOnList: boolean
  pairPlan: PairPlanRecord | null
  weekStart: string | null
}

export function normalizePairSymbol(pair: string | null | undefined): string {
  if (!pair) return ""
  return pair.replace(/[/\s_-]/g, "").toUpperCase()
}

export function getWatchlistPairs(plan: WeeklyPlanWithPairs | null | undefined): PairPlanRecord[] {
  return plan?.pairs ?? []
}

export function isWatchlistComplete(plan: WeeklyPlanWithPairs | null | undefined): boolean {
  const count = getWatchlistPairs(plan).length
  return count >= WEEKLY_WATCHLIST_MIN && count <= WEEKLY_WATCHLIST_MAX
}

export function findPairOnWatchlist(
  pair: string | null | undefined,
  plan: WeeklyPlanWithPairs | null | undefined,
): PairPlanRecord | null {
  const key = normalizePairSymbol(pair)
  if (!key) return null
  return (
    getWatchlistPairs(plan).find((p) => normalizePairSymbol(p.pair) === key) ?? null
  )
}

export function evaluateWeeklyWatchlistGate(input: {
  pair: string | null | undefined
  weekPlan: WeeklyPlanWithPairs | null | undefined
}): WeeklyWatchlistGateResult {
  const pairs = getWatchlistPairs(input.weekPlan)
  const pairCount = pairs.length
  const watchlistComplete = isWatchlistComplete(input.weekPlan)
  const weekStart = input.weekPlan?.week_start ?? null
  const normalizedPair = normalizePairSymbol(input.pair)
  const pairPlan = findPairOnWatchlist(input.pair, input.weekPlan)
  const pairOnList = Boolean(pairPlan)

  if (!watchlistComplete) {
    const blocked = Boolean(normalizedPair) || pairCount === 0
    return {
      allowed: !blocked,
      severity: blocked ? "blocked" : "warning",
      headline: "Sunday watchlist required",
      message:
        pairCount === 0
          ? `Add at least one pair in War Room before opening pre-trade Coach.`
          : pairCount < WEEKLY_WATCHLIST_RECOMMENDED
            ? `You have ${pairCount} pair — add ${WEEKLY_WATCHLIST_RECOMMENDED}–${WEEKLY_WATCHLIST_MAX} in War Room for full weekly focus (or continue with one pair).`
            : `You have ${pairCount} pair${pairCount === 1 ? "" : "s"} — add up to ${WEEKLY_WATCHLIST_MAX} in War Room.`,
      watchlistComplete: false,
      pairCount,
      pairOnList: false,
      pairPlan: null,
      weekStart,
    }
  }

  if (!normalizedPair) {
    return {
      allowed: true,
      severity: "ok",
      headline: "Watchlist active",
      message: `This week's focus: ${pairs.map((p) => p.pair).join(", ")}.`,
      watchlistComplete: true,
      pairCount,
      pairOnList: false,
      pairPlan: null,
      weekStart,
    }
  }

  if (!pairOnList) {
    return {
      allowed: false,
      severity: "blocked",
      headline: "Pair not on this week's list",
      message: `${input.pair} is not on your Sunday watchlist (${pairs.map((p) => p.pair).join(", ")}). Add it in War Room or pick a listed pair.`,
      watchlistComplete: true,
      pairCount,
      pairOnList: false,
      pairPlan: null,
      weekStart,
    }
  }

  if (pairPlan?.aoi_status === "INVALIDATED") {
    return {
      allowed: true,
      severity: "warning",
      headline: "AOI invalidated on watchlist",
      message: `${pairPlan.pair} is marked INVALIDATED — only coach if you have a fresh thesis.`,
      watchlistComplete: true,
      pairCount,
      pairOnList: true,
      pairPlan,
      weekStart,
    }
  }

  return {
    allowed: true,
    severity: "ok",
    headline: "On weekly watchlist",
    message: pairPlan?.weekly_thesis?.trim()
      ? pairPlan.weekly_thesis.trim()
      : `${pairPlan?.pair} is on this week's focus list.`,
    watchlistComplete: true,
    pairCount,
    pairOnList: true,
    pairPlan,
    weekStart,
  }
}

export function buildPlannedContextFromPairPlan(
  pairPlan: PairPlanRecord,
  strategyName?: string,
): import("@/lib/trade-coach/types").PreTradePlannedContext {
  const bias =
    pairPlan.directional_bias === "Bullish"
      ? "LONG"
      : pairPlan.directional_bias === "Bearish"
        ? "SHORT"
        : undefined
  return {
    pair: pairPlan.pair,
    direction: bias,
    strategy_name: strategyName ?? "Multi-Timeframe FX Continuation Setup",
    higher_timeframe: "Weekly / Daily / H4",
    entry_timeframe: "H1",
    confirmation_timeframe: "M15",
    session: "",
  }
}
