import type { PaperTradeRecord, PaperTradeStats } from "@/lib/paper-trades/types"

export function normalizePaperResult(value: string | null | undefined): PaperTradeRecord["result"] {
  const upper = (value ?? "PENDING").toUpperCase()
  if (upper === "WIN" || upper === "LOSS" || upper === "BREAKEVEN") return upper
  return "PENDING"
}

export function computePaperWinStreak(trades: PaperTradeRecord[]): number {
  const closed = [...trades]
    .filter((trade) => trade.result !== "PENDING")
    .sort((a, b) => {
      const da = a.closed_at ?? a.created_at
      const db = b.closed_at ?? b.created_at
      return db.localeCompare(da)
    })

  let streak = 0
  for (const trade of closed) {
    if (trade.result === "WIN") {
      streak++
      continue
    }
    if (trade.result === "BREAKEVEN") continue
    break
  }
  return streak
}

export function computePaperTradeStats(trades: PaperTradeRecord[]): PaperTradeStats {
  const closed = trades.filter((trade) => trade.result !== "PENDING")
  const wins = closed.filter((trade) => trade.result === "WIN").length
  const losses = closed.filter((trade) => trade.result === "LOSS").length
  const pending = trades.filter((trade) => trade.result === "PENDING").length
  const totalPnL = closed.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0)
  const rrValues = closed.map((trade) => trade.rr).filter((value): value is number => value != null)
  const avgRR =
    rrValues.length > 0 ? rrValues.reduce((sum, value) => sum + value, 0) / rrValues.length : null
  const winStreak = computePaperWinStreak(trades)
  const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0
  const readyForLive = winStreak >= 3

  return {
    total: trades.length,
    pending,
    wins,
    losses,
    winRate,
    totalPnL,
    avgRR,
    winStreak,
    readyForLive,
    graduationMessage: readyForLive
      ? "Setup proven. Ready to go live?"
      : winStreak > 0
        ? `${winStreak}/3 winning paper trades toward graduation`
        : null,
  }
}

export function computeAchievedRR(input: {
  direction: string
  entry: number
  sl: number
  closePrice: number
}): number | null {
  const risk = Math.abs(input.entry - input.sl)
  if (risk <= 0) return null
  const dir = input.direction.toUpperCase()
  const reward =
    dir === "BUY" || dir === "LONG"
      ? input.closePrice - input.entry
      : input.entry - input.closePrice
  return Number((reward / risk).toFixed(2))
}

export function biasToDirection(bias: string | null | undefined): string {
  const normalized = (bias ?? "").toLowerCase()
  if (normalized.includes("bull")) return "BUY"
  if (normalized.includes("bear")) return "SELL"
  return "BUY"
}

export function signalDirectionToTradeDirection(direction: string | null | undefined): string {
  const normalized = (direction ?? "").toUpperCase()
  if (normalized.includes("SELL") || normalized.includes("SHORT") || normalized.includes("BEAR")) {
    return "SELL"
  }
  return "BUY"
}
