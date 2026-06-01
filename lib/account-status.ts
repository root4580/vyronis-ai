import { filterRowsForAccount } from "@/lib/accounts/account-query"
import { computeMinBalance, computeTargetProgress } from "@/lib/accounts/profit-target"
import type { TradingAccountRecord } from "@/lib/accounts/types"
import { getWeekTradeBounds } from "@/lib/hq-dashboard-metrics"
import {
  DEFAULT_USER_SETTINGS,
  getTodayLossPercent,
  getTodayTrades,
  normalizeUserSettings,
  type SettingsTrade,
  type UserSettingsForm,
} from "@/lib/user-settings"
import { getSignedPnL } from "@/lib/trade-utils"

export const WEEKLY_DRAWDOWN_LIMIT_PERCENT = 5
export const MAX_TRADES_PER_WEEK = 2

export type PropFirmRuleStatus = "safe" | "caution" | "danger" | "stop"

export type AccountStatusSnapshot = {
  accountName: string
  currency: string
  startingBalance: number
  accountBalance: number
  totalPnL: number
  drawdownPercent: number
  maxDrawdownPercent: number
  minBalance: number
  amountAboveFloor: number
  profitTarget: number
  profitGoalPercent: number
  profitGoalAmount: number
  amountToTarget: number
  targetProgressPercent: number
  targetReached: boolean
  /** Starting balance + profit goal (e.g. $10k start → $11k target at 10%). */
  targetBalance: number
  dailyLossPercent: number
  dailyLossLimitPercent: number
  weeklyLossPercent: number
  weeklyLossLimitPercent: number
  tradesToday: number
  maxTradesPerDay: number
  tradesThisWeek: number
  maxTradesPerWeek: number
  ruleStatus: PropFirmRuleStatus
  ruleLabel: string
  ruleMessage: string
  hasLossStreak: boolean
  limitUsages: {
    drawdown: number
    dailyLoss: number
    weeklyLoss: number
    tradesToday: number
    tradesThisWeek: number
  }
}

function isTradeInCurrentWeek(
  trade: Pick<SettingsTrade, "trade_date" | "created_at">,
  now = new Date(),
): boolean {
  const raw = trade.trade_date || trade.created_at?.split("T")[0]
  if (!raw) return false
  const date = new Date(`${raw}T12:00:00`)
  if (Number.isNaN(date.getTime())) return false
  const { start, end } = getWeekTradeBounds(now)
  return date >= start && date < end
}

function getWeekTrades<T extends Pick<SettingsTrade, "trade_date" | "created_at">>(
  trades: T[],
  now = new Date(),
): T[] {
  return trades.filter((trade) => isTradeInCurrentWeek(trade, now))
}

export function getWeekLossPercent(
  trades: SettingsTrade[],
  startingBalance: number,
  now = new Date(),
): number {
  if (startingBalance <= 0) return 0

  const weekLossAmount = getWeekTrades(trades, now).reduce((sum, trade) => {
    const signed = getSignedPnL(trade.pnl, trade.result)
    return signed < 0 ? sum + Math.abs(signed) : sum
  }, 0)

  return (weekLossAmount / startingBalance) * 100
}

export function getDrawdownPercent(startingBalance: number, accountBalance: number): number {
  if (startingBalance <= 0 || accountBalance >= startingBalance) return 0
  return ((startingBalance - accountBalance) / startingBalance) * 100
}

export function computeBalanceFromTradeLog(
  trades: SettingsTrade[],
  startingBalance: number,
): { accountBalance: number; totalPnL: number } {
  const totalPnL = trades.reduce((sum, trade) => sum + getSignedPnL(trade.pnl, trade.result), 0)
  return {
    accountBalance: startingBalance + totalPnL,
    totalPnL,
  }
}

function hasRecentLossStreak(
  trades: SettingsTrade[],
  count = 3,
  now = new Date(),
): boolean {
  const weekTrades = getWeekTrades(trades, now)
  const sorted = [...weekTrades].sort((a, b) => {
    const da = a.trade_date ?? a.created_at ?? ""
    const db = b.trade_date ?? b.created_at ?? ""
    return db.localeCompare(da)
  })
  if (sorted.length < count) return false
  return sorted.slice(0, count).every((trade) => {
    const pnl = getSignedPnL(trade.pnl, trade.result)
    return trade.result?.toLowerCase() === "loss" || pnl < 0
  })
}

function resolvePropFirmRuleStatus(input: {
  accountBalance: number
  minBalance: number
  limitUsages: AccountStatusSnapshot["limitUsages"]
}): {
  status: PropFirmRuleStatus
  label: string
  message: string
} {
  const atDrawdownFloor = input.accountBalance <= input.minBalance
  const dailyStop = input.limitUsages.dailyLoss >= 100 || input.limitUsages.tradesToday >= 100

  if (atDrawdownFloor || dailyStop) {
    return {
      status: "stop",
      label: "STOP",
      message: atDrawdownFloor
        ? "Max drawdown hit — stop trading"
        : "Daily limit hit — no more trades today",
    }
  }

  const maxUsage = Math.max(
    input.limitUsages.drawdown,
    input.limitUsages.dailyLoss,
    input.limitUsages.weeklyLoss,
    input.limitUsages.tradesToday,
    input.limitUsages.tradesThisWeek,
  )

  if (maxUsage >= 90) {
    return {
      status: "danger",
      label: "DANGER",
      message: "Near breach — slow down",
    }
  }

  if (maxUsage >= 80) {
    return {
      status: "caution",
      label: "CAUTION",
      message: "Approaching limit (80%+)",
    }
  }

  return {
    status: "safe",
    label: "SAFE",
    message: "Under all limits",
  }
}

export function evaluateAccountStatus(input: {
  trades: SettingsTrade[]
  account: Pick<
    TradingAccountRecord,
    | "name"
    | "starting_balance"
    | "max_drawdown_pct"
    | "currency"
    | "max_trades_per_week"
  >
  settings?: UserSettingsForm | null
  referenceDate?: Date
}): AccountStatusSnapshot {
  const settings = normalizeUserSettings(input.settings ?? DEFAULT_USER_SETTINGS)
  const startingBalance = input.account.starting_balance
  const referenceDate = input.referenceDate ?? new Date()
  const { accountBalance, totalPnL } = computeBalanceFromTradeLog(input.trades, startingBalance)

  const drawdownPercent = getDrawdownPercent(startingBalance, accountBalance)
  const maxDrawdownPercent = input.account.max_drawdown_pct
  const minBalance = computeMinBalance(startingBalance, maxDrawdownPercent)
  const amountAboveFloor = Math.max(0, accountBalance - minBalance)
  const target = computeTargetProgress(
    accountBalance,
    startingBalance,
    settings.profit_target,
  )

  const dailyLossPercent = getTodayLossPercent(input.trades, startingBalance)
  const weeklyLossPercent = getWeekLossPercent(input.trades, startingBalance, referenceDate)
  const tradesToday = getTodayTrades(input.trades, referenceDate).length
  const tradesThisWeek = getWeekTrades(input.trades, referenceDate).length

  const dailyLossLimitPercent = settings.daily_drawdown_limit
  const weeklyLossLimitPercent = WEEKLY_DRAWDOWN_LIMIT_PERCENT
  const maxTradesPerDay = settings.max_trades_per_day
  const maxTradesPerWeek = input.account.max_trades_per_week ?? MAX_TRADES_PER_WEEK

  const limitUsages = {
    drawdown: maxDrawdownPercent > 0 ? (drawdownPercent / maxDrawdownPercent) * 100 : 0,
    dailyLoss:
      dailyLossLimitPercent > 0 ? (dailyLossPercent / dailyLossLimitPercent) * 100 : 0,
    weeklyLoss:
      weeklyLossLimitPercent > 0 ? (weeklyLossPercent / weeklyLossLimitPercent) * 100 : 0,
    tradesToday: maxTradesPerDay > 0 ? (tradesToday / maxTradesPerDay) * 100 : 0,
    tradesThisWeek: maxTradesPerWeek > 0 ? (tradesThisWeek / maxTradesPerWeek) * 100 : 0,
  }

  const rule = resolvePropFirmRuleStatus({ accountBalance, minBalance, limitUsages })

  return {
    accountName: input.account.name,
    currency: input.account.currency,
    startingBalance,
    accountBalance,
    totalPnL,
    drawdownPercent,
    maxDrawdownPercent,
    minBalance,
    amountAboveFloor,
    profitTarget: target.profitTarget,
    profitGoalPercent: settings.profit_target,
    profitGoalAmount: target.profitGoalAmount,
    amountToTarget: target.amountToTarget,
    targetProgressPercent: target.progressPercent,
    targetReached: target.targetReached,
    targetBalance: startingBalance + target.profitGoalAmount,
    dailyLossPercent,
    dailyLossLimitPercent,
    weeklyLossPercent,
    weeklyLossLimitPercent,
    tradesToday,
    maxTradesPerDay,
    tradesThisWeek,
    maxTradesPerWeek,
    ruleStatus: rule.status,
    ruleLabel: rule.label,
    ruleMessage: rule.message,
    hasLossStreak: hasRecentLossStreak(input.trades, 3, referenceDate),
    limitUsages,
  }
}

export function getPropFirmStatusEmoji(status: PropFirmRuleStatus): string {
  switch (status) {
    case "stop":
      return "⛔"
    case "danger":
      return "🔴"
    case "caution":
      return "🟡"
    default:
      return "🟢"
  }
}

export function filterTradesForAccount<T extends { account_id?: string | null }>(
  trades: T[],
  accountId: string | null | undefined,
  legacyAccountId?: string | null,
): T[] {
  return filterRowsForAccount(trades, accountId, legacyAccountId)
}
