/** Minimum trades before surfacing psychology / emotion insights. */
export const MIN_EMOTION_INSIGHT_TRADES = 10

/** Minimum trades in a bucket before session/pair/setup insights. */
export const MIN_GROUP_INSIGHT_TRADES = 3

/** Minimum overall journal size before pattern recognition runs. */
export const MIN_JOURNAL_INSIGHT_TRADES = 5

/** Minimum trades before percentage-based behavior claims (e.g. "88% of trades"). */
export const MIN_PATTERN_PERCENT_CLAIM_TRADES = 8

/** Minimum tagged events before streak-style behavior claims. */
export const MIN_BEHAVIOR_EVENT_COUNT = 3

export const INSUFFICIENT_HISTORY_MESSAGE =
  "Not enough journal history to establish a reliable pattern."

export function hasPositiveWinRate(winRate: number): boolean {
  return winRate > 0
}

export function isProfitableTrade(result: string, pnl: number): boolean {
  return result === "WIN" || pnl > 0
}

export function getBestTradeHighlightLabel(result: string, pnl: number): "Best Trade" | "Best Executed Trade" {
  return isProfitableTrade(result, pnl) ? "Best Trade" : "Best Executed Trade"
}
