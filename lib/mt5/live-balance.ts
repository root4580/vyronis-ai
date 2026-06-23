/** MT5 balance is considered live if pinged within this window. */
export const MT5_BALANCE_FRESH_MS = 30 * 60 * 1000

export type AccountBalanceSource = "mt5" | "journal"

export function isMt5BalanceFresh(
  lastPingAt: string | null | undefined,
  maxAgeMs = MT5_BALANCE_FRESH_MS,
): boolean {
  if (!lastPingAt?.trim()) return false
  const ts = new Date(lastPingAt).getTime()
  return Number.isFinite(ts) && Date.now() - ts <= maxAgeMs
}

export function normalizeMt5Balance(value: unknown): number | null {
  if (value == null) return null
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

export function resolveMt5LiveBalance(
  mt5Balance: number | null | undefined,
  lastPingAt?: string | null,
  lastSyncAt?: string | null,
): number | null {
  const normalized = normalizeMt5Balance(mt5Balance)
  if (normalized == null || normalized <= 0) return null
  if (!isMt5BalanceFresh(lastPingAt) && !isMt5BalanceFresh(lastSyncAt)) return null
  return normalized
}

export function resolveAccountBalance(input: {
  startingBalance: number
  totalPnL: number
  mt5Balance?: number | null
  mt5LastPingAt?: string | null
  mt5LastSyncAt?: string | null
}): { balance: number; source: AccountBalanceSource } {
  const journalBalance = input.startingBalance + input.totalPnL
  const mt5Live = resolveMt5LiveBalance(
    input.mt5Balance,
    input.mt5LastPingAt,
    input.mt5LastSyncAt,
  )
  if (mt5Live != null) {
    return { balance: mt5Live, source: "mt5" }
  }
  return { balance: journalBalance, source: "journal" }
}

/** Always 2 decimals — matches MT5 ACCOUNT_BALANCE display. */
export function formatExactMt5Money(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `$${amount.toFixed(2)}`
  }
}
