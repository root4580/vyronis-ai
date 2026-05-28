import type { RecentTradeMemory } from "@/lib/intelligence/conversational-types"

function dayLabel(trade: RecentTradeMemory): string {
  const raw = trade.trade_date || trade.created_at
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return "recently"

  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "today"
  if (diffDays === 1) return "yesterday"
  if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "long" })
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function buildMemoryCallbacks(trades: RecentTradeMemory[]): string[] {
  const callbacks: string[] = []
  if (trades.length === 0) return callbacks

  const recentLoss = trades.find((t) => t.result === "LOSS")
  if (recentLoss?.pair) {
    callbacks.push(
      `This resembles your ${recentLoss.pair} ${recentLoss.direction || ""} loss from ${dayLabel(recentLoss)}`.trim(),
    )
  }

  const londonTrades = trades.filter((t) => /london/i.test(t.session || ""))
  const nyTrades = trades.filter((t) => /ny|new york/i.test(t.session || ""))
  if (londonTrades.length >= 2) {
    const wins = londonTrades.filter((t) => t.result === "WIN").length
    const wr = Math.round((wins / londonTrades.length) * 100)
    if (wr >= 60) {
      callbacks.push("You handled risk better during London session.")
    }
  }
  if (nyTrades.length >= 2) {
    const ruleBreaks = nyTrades.filter((t) => t.rule_followed === false).length
    if (ruleBreaks >= 2) {
      callbacks.push("NY session trades have been slipping on rule adherence lately.")
    }
  }

  const recentWin = trades.find((t) => t.result === "WIN")
  if (recentWin?.pair && recentLoss?.pair && recentWin.pair !== recentLoss.pair) {
    callbacks.push(
      `Your last win on ${recentWin.pair} was cleaner than the ${recentLoss.pair} loss — different execution quality.`,
    )
  }

  return callbacks.slice(0, 2)
}

export function pickMemoryReference(
  trades: RecentTradeMemory[],
  userMessage: string,
): string | undefined {
  const callbacks = buildMemoryCallbacks(trades)
  if (callbacks.length === 0) return undefined

  const text = userMessage.toLowerCase()
  if (/similar|before|last|history|remember|tuesday|yesterday|again/.test(text)) {
    return callbacks[0]
  }
  if (/session|london|ny|asia/.test(text) && callbacks[1]) {
    return callbacks[1]
  }
  return undefined
}
