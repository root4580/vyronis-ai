import { getSignedPnL } from "@/lib/trade-utils"

type JournalTradeForBalance = {
  pnl: number | null | undefined
  result: string | null | undefined
}

const CLOSED_RESULTS = new Set(["WIN", "LOSS", "BE", "BREAKEVEN"])

/**
 * Sum journal P&L for account-balance prefill.
 * Skips trades without a closed result or without numeric P&L (null/NaN).
 * Breakeven trades always contribute 0.
 */
export function sumJournalPnLForAccountBalance(trades: JournalTradeForBalance[]): {
  totalPnL: number
  countedTrades: number
  skippedTrades: number
} {
  let totalPnL = 0
  let countedTrades = 0
  let skippedTrades = 0

  for (const trade of trades) {
    const result = trade.result?.trim().toUpperCase()
    if (!result || !CLOSED_RESULTS.has(result)) {
      skippedTrades += 1
      continue
    }

    if (result === "BE" || result === "BREAKEVEN") {
      countedTrades += 1
      continue
    }

    const pnl = trade.pnl
    if (pnl == null || !Number.isFinite(Number(pnl))) {
      skippedTrades += 1
      continue
    }

    totalPnL += getSignedPnL(Number(pnl), result)
    countedTrades += 1
  }

  return { totalPnL, countedTrades, skippedTrades }
}

export function computeCurrentAccountBalance(
  startingBalance: number,
  trades: JournalTradeForBalance[],
): {
  balance: number
  totalPnL: number
  skippedTrades: number
} {
  const { totalPnL, skippedTrades } = sumJournalPnLForAccountBalance(trades)
  const safeStarting = Number.isFinite(startingBalance) && startingBalance > 0 ? startingBalance : 0

  return {
    balance: safeStarting + totalPnL,
    totalPnL,
    skippedTrades,
  }
}
