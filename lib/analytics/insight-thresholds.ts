/** Minimum trades before surfacing psychology / emotion insights. */
export const MIN_EMOTION_INSIGHT_TRADES = 10

/** Minimum trades in a bucket before session/pair/setup insights. */
export const MIN_GROUP_INSIGHT_TRADES = 3

/** Minimum overall journal size before pattern recognition runs. */
export const MIN_JOURNAL_INSIGHT_TRADES = 5

export function hasPositiveWinRate(winRate: number): boolean {
  return winRate > 0
}

export function isProfitableTrade(result: string, pnl: number): boolean {
  return result === "WIN" || pnl > 0
}

export function getBestTradeHighlightLabel(result: string, pnl: number): "Best Trade" | "Best Executed Trade" {
  return isProfitableTrade(result, pnl) ? "Best Trade" : "Best Executed Trade"
}
