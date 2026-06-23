/** Profit goal is a % of starting balance — displayed target is the starting amount itself. */
export const DEFAULT_PROFIT_GOAL_PERCENT = 10

export function computeProfitTarget(startingBalance: number): number {
  return startingBalance
}

export function computeMinBalance(startingBalance: number, maxDrawdownPct: number): number {
  return startingBalance * (1 - maxDrawdownPct / 100)
}

export function computeTargetProgress(
  currentBalance: number,
  startingBalance: number,
  profitGoalPercent = DEFAULT_PROFIT_GOAL_PERCENT,
): {
  profitTarget: number
  profitGoalAmount: number
  amountToTarget: number
  progressPercent: number
  targetReached: boolean
} {
  const profitTarget = startingBalance
  const totalPnL = currentBalance - startingBalance
  const profitGoalAmount =
    startingBalance > 0 ? startingBalance * (profitGoalPercent / 100) : 0
  const amountToTarget = Math.max(0, profitGoalAmount - totalPnL)
  const progressPercent =
    profitGoalAmount > 0
      ? Math.min(100, Math.max(0, (totalPnL / profitGoalAmount) * 100))
      : totalPnL >= 0
        ? 100
        : 0

  return {
    profitTarget,
    profitGoalAmount,
    amountToTarget,
    progressPercent,
    targetReached: totalPnL >= profitGoalAmount,
  }
}

export function formatAccountMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }
}

/** Shows cents when balance moved or P&L is non-zero — avoids $100,000 masking -$0.22. */
export function formatLiveAccountMoney(
  amount: number,
  options?: { currency?: string; totalPnL?: number },
): string {
  const currency = options?.currency ?? "USD"
  const totalPnL = options?.totalPnL ?? 0
  const hasCents = Math.abs(amount % 1) > 0.004
  const showDecimals =
    hasCents || (Math.abs(totalPnL) > 0.004 && Math.abs(totalPnL) < 50_000)

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    }).format(amount)
  } catch {
    return `$${amount.toLocaleString(undefined, {
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    })}`
  }
}
