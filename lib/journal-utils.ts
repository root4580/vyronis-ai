import { getSignedPnL } from "@/lib/trade-utils"

export type JournalTrade = {
  id: string
  pair: string
  direction: string
  result: string
  pnl: number
  emotion: string
  session: string | null
  setup: string
  strategy_name: string | null
  risk_percent: number | null
  rule_followed: boolean | null
  confirmation_signal: string | null
  trade_date: string | null
  created_at: string
  screenshot_url: string | null
  mistake_tags?: string | null
  user_id?: string | null
  higher_timeframe?: string | null
  entry_timeframe?: string | null
  confirmation_timeframe?: string | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
  risk_reward?: number | null
  trade_notes?: string | null
  emotion_after?: string | null
  setup_score?: number | null
  setup_classification?: string | null
  setup_score_breakdown?: import("@/lib/trade-coach/setup-score-engine").SetupScoreBreakdown | null
  setup_coaching_insights?: import("@/lib/trade-coach/setup-score-engine").SetupCoachingInsight[] | null
}

export type JournalSortKey = "date" | "pair" | "pnl" | "result"
export type JournalSortDir = "asc" | "desc"

export type JournalFilters = {
  search: string
  pair: string
  session: string
  result: string
}

export const DEFAULT_JOURNAL_FILTERS: JournalFilters = {
  search: "",
  pair: "all",
  session: "all",
  result: "all",
}

function getTradeDate(trade: JournalTrade): number {
  return new Date(trade.trade_date || trade.created_at).getTime()
}

export function filterAndSortTrades<T extends JournalTrade>(
  trades: T[],
  filters: JournalFilters,
  sortKey: JournalSortKey,
  sortDir: JournalSortDir,
): T[] {
  const query = filters.search.trim().toLowerCase()

  let filtered = trades.filter((trade) => {
    if (filters.pair !== "all" && trade.pair !== filters.pair) return false
    if (filters.session !== "all" && (trade.session || "Unknown") !== filters.session) return false
    if (filters.result !== "all" && trade.result !== filters.result) return false

    if (!query) return true

    const haystack = [
      trade.pair,
      trade.direction,
      trade.result,
      trade.session,
      trade.setup,
      trade.strategy_name,
      trade.emotion,
      ...(trade.mistake_tags ? trade.mistake_tags.split(",") : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    return haystack.includes(query)
  })

  filtered = [...filtered].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case "pair":
        cmp = a.pair.localeCompare(b.pair)
        break
      case "pnl":
        cmp = getSignedPnL(a.pnl, a.result) - getSignedPnL(b.pnl, b.result)
        break
      case "result":
        cmp = a.result.localeCompare(b.result)
        break
      case "date":
      default:
        cmp = getTradeDate(a) - getTradeDate(b)
        break
    }
    return sortDir === "asc" ? cmp : -cmp
  })

  return filtered
}

export function getJournalFilterOptions(trades: JournalTrade[]) {
  const pairs = [...new Set(trades.map((t) => t.pair))].sort()
  const sessions = [...new Set(trades.map((t) => t.session || "Unknown"))].sort()
  const results = [...new Set(trades.map((t) => t.result))].sort()
  return { pairs, sessions, results }
}
