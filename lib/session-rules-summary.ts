import type { TradingOsSnapshot } from "@/lib/trading-os/types"

export function buildSessionRulesSummary(input: {
  watchlistPairs?: string[]
  maxRiskPerTrade?: number
  maxTradesPerDay?: number
  tradingOs?: TradingOsSnapshot | null
}): string {
  const pairs = (input.watchlistPairs ?? []).filter(Boolean)
  const pairPhrase =
    pairs.length > 0
      ? pairs.length <= 4
        ? pairs.join(", ")
        : `${pairs.slice(0, 3).join(", ")} +${pairs.length - 3}`
      : "set watchlist in War Room"

  const maxRisk = input.maxRiskPerTrade ?? 1
  const maxTrades = input.maxTradesPerDay ?? 3
  const session = input.tradingOs?.liveSession.activeSession ?? "Active session"
  const cap =
    input.tradingOs?.liveSession.overtradingLevel === "critical"
      ? " · daily cap reached"
      : ""

  return `Today: ${pairPhrase} only · max ${maxTrades} trades · ${maxRisk}% risk/trade · ${session}${cap}`
}
