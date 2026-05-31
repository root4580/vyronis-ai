import { normalizeTradePlannerPair } from "@/lib/trade-planner/forex-pairs"
import type { SavedTradePlan, TradePlanStatus } from "@/lib/trade-planner/types"

export const PLAN_EXPIRY_DAYS = 3

/** Local calendar date key (YYYY-MM-DD) in the user's timezone. */
export function getLocalDateKey(isoTimestamp: string, timeZone?: string): string {
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) return ""

  if (timeZone) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date)
    } catch {
      // fall through
    }
  }

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function isSameLocalCalendarDay(
  isoTimestamp: string,
  dateKey: string,
  timeZone?: string,
): boolean {
  if (!dateKey) return false
  return getLocalDateKey(isoTimestamp, timeZone) === dateKey
}

export function isPlanExpired(createdAt: string, now = Date.now()): boolean {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  const expiryMs = PLAN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  return now - created >= expiryMs
}

export function normalizePlanPair(pair: string): string {
  return normalizeTradePlannerPair(pair)
}

export function pairsMatch(planPair: string, tradePair: string): boolean {
  return normalizePlanPair(planPair) === normalizePlanPair(tradePair)
}

export type MatchableTradePlan = Pick<
  SavedTradePlan,
  | "id"
  | "pair"
  | "direction"
  | "status"
  | "created_at"
  | "accountSize"
  | "entryPrice"
  | "stopLoss"
  | "takeProfit"
  | "recommendedLots"
  | "riskAmount"
  | "rr"
  | "riskPercent"
>

export function filterActivePlansForTrade(
  plans: MatchableTradePlan[],
  options: {
    pair: string
    tradeDate: string
    timeZone?: string
    now?: number
  },
): MatchableTradePlan[] {
  const { pair, tradeDate, timeZone, now = Date.now() } = options

  return plans.filter((plan) => {
    if (plan.status !== "active") return false
    if (isPlanExpired(plan.created_at, now)) return false
    if (!pairsMatch(plan.pair, pair)) return false
    return isSameLocalCalendarDay(plan.created_at, tradeDate, timeZone)
  })
}

export function planIdsToExpire(plans: { id: string; status: TradePlanStatus; created_at: string }[]): string[] {
  const now = Date.now()
  return plans
    .filter((plan) => plan.status === "active" && isPlanExpired(plan.created_at, now))
    .map((plan) => plan.id)
}
