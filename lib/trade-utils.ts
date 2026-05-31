/** Normalize P&L sign from trade result (users enter magnitude only). */
export function getSignedPnL(pnl: number, result: string): number {
  const amount = Math.abs(Number(pnl) || 0)

  if (result === "LOSS") return -amount
  if (result === "WIN") return amount
  if (result === "BE" || result === "BREAKEVEN") return 0

  return Number(pnl) || 0
}

/** Map UI result labels to DB enum values (trades.result CHECK uses WIN/LOSS/BE). */
export function normalizeTradeResultForDb(result: string): string {
  if (result === "BREAKEVEN") return "BE"
  return result
}

export function normalizePnL(pnl: number, result: string): number {
  return getSignedPnL(pnl, result)
}

/** Preview/import rows: show signed dollar amount without BE zeroing. */
export function formatSignedDollarPnl(pnl: number): string {
  const abs = Math.abs(Number(pnl) || 0)
  const formatted = Number.isInteger(abs) ? String(abs) : abs.toFixed(2)
  return pnl >= 0 ? `+$${formatted}` : `-$${formatted}`
}

export function formatPnL(pnl: number, result: string): string {
  const signed = getSignedPnL(pnl, result)
  const abs = Math.abs(signed)
  const formatted = Number.isInteger(abs) ? String(abs) : abs.toFixed(2)

  return signed >= 0 ? `+$${formatted}` : `-$${formatted}`
}

export function getPnLTextClass(pnl: number, result: string): string {
  return getSignedPnL(pnl, result) >= 0 ? "text-profit" : "text-loss"
}

/** Sentence-case result label for UI (DB values stay WIN/LOSS/BE). */
export function formatTradeResultLabel(result: string | null | undefined): string {
  if (!result) return "—"
  if (result === "WIN") return "Win"
  if (result === "LOSS") return "Loss"
  if (result === "BE" || result === "BREAKEVEN") return "BE"
  return result
}
