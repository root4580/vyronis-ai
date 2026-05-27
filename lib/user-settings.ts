import { getSignedPnL } from "@/lib/trade-utils"
import type { DashboardPreferences } from "@/lib/user-preferences"

export type UserSettingsRecord = {
  id?: string
  user_id: string
  starting_balance: number
  daily_drawdown_limit: number
  max_risk_per_trade: number
  max_trades_per_day: number
  prop_firm_size: string
  profit_target: number
  preferred_session?: string
  dashboard_preferences?: DashboardPreferences | null
  updated_at?: string
}

export type UserSettingsForm = Omit<UserSettingsRecord, "id" | "user_id" | "updated_at" | "dashboard_preferences">

export const DEFAULT_USER_SETTINGS: UserSettingsForm = {
  starting_balance: 10000,
  daily_drawdown_limit: 5,
  max_risk_per_trade: 1,
  max_trades_per_day: 3,
  prop_firm_size: "10K",
  profit_target: 10,
  preferred_session: "NY Session",
}

export const PROP_FIRM_SIZES = ["5K", "10K", "25K", "50K", "100K", "150K", "200K"] as const

export type SettingsTrade = {
  risk_percent: number | null
  rule_followed: boolean | null
  emotion: string
  stop_loss?: number | null
  trade_date?: string | null
  created_at: string
  result: string
  pnl: number
}

export type DailyRuleItem = {
  id: string
  rule: string
  checked: boolean
}

export type RiskSnapshot = {
  maxRiskPerTrade: number
  dailyLossLimit: number
  todayLossPercent: number
  todayRiskUsed: number
  avgRiskPerTrade: number
  highRiskTradeCount: number
}

export function normalizeUserSettings(data: Partial<UserSettingsRecord> | null | undefined): UserSettingsForm {
  return {
    starting_balance: data?.starting_balance ?? DEFAULT_USER_SETTINGS.starting_balance,
    daily_drawdown_limit: data?.daily_drawdown_limit ?? DEFAULT_USER_SETTINGS.daily_drawdown_limit,
    max_risk_per_trade: data?.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade,
    max_trades_per_day: data?.max_trades_per_day ?? DEFAULT_USER_SETTINGS.max_trades_per_day,
    prop_firm_size: data?.prop_firm_size ?? DEFAULT_USER_SETTINGS.prop_firm_size,
    profit_target: data?.profit_target ?? DEFAULT_USER_SETTINGS.profit_target,
    preferred_session: data?.preferred_session ?? DEFAULT_USER_SETTINGS.preferred_session,
  }
}

export function getTradeDateKey(trade: Pick<SettingsTrade, "trade_date" | "created_at">): string {
  if (trade.trade_date) {
    return trade.trade_date.split("T")[0]
  }

  const created = new Date(trade.created_at)
  const year = created.getFullYear()
  const month = String(created.getMonth() + 1).padStart(2, "0")
  const day = String(created.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getTradeTimestamp(trade: Pick<SettingsTrade, "trade_date" | "created_at">): number {
  return new Date(trade.trade_date || trade.created_at).getTime()
}

export function getTradeWeekday(trade: Pick<SettingsTrade, "trade_date" | "created_at">): number {
  return new Date(trade.trade_date || trade.created_at).getDay()
}

export function getTodayTrades<T extends Pick<SettingsTrade, "trade_date" | "created_at">>(
  trades: T[],
  referenceDate = new Date(),
): T[] {
  const todayKey = getLocalDateKey(referenceDate)
  return trades.filter((trade) => getTradeDateKey(trade) === todayKey)
}

export function getTodayLossPercent(trades: SettingsTrade[], startingBalance: number): number {
  if (startingBalance <= 0) return 0

  const todayTrades = getTodayTrades(trades)
  const todayLossAmount = todayTrades.reduce((sum, trade) => {
    const signed = getSignedPnL(trade.pnl, trade.result)
    return signed < 0 ? sum + Math.abs(signed) : sum
  }, 0)

  return (todayLossAmount / startingBalance) * 100
}

export function buildRiskSnapshot(
  settings: UserSettingsForm,
  trades: SettingsTrade[],
  startingBalance: number,
): RiskSnapshot {
  const todayTrades = getTodayTrades(trades)
  const todayRiskUsed = todayTrades.reduce((sum, trade) => sum + (trade.risk_percent ?? 0), 0)
  const avgRiskPerTrade =
    trades.length > 0
      ? trades.reduce((sum, trade) => sum + (trade.risk_percent ?? 0), 0) / trades.length
      : 0

  return {
    maxRiskPerTrade: settings.max_risk_per_trade,
    dailyLossLimit: settings.daily_drawdown_limit,
    todayLossPercent: getTodayLossPercent(trades, startingBalance),
    todayRiskUsed,
    avgRiskPerTrade,
    highRiskTradeCount: trades.filter(
      (trade) => (trade.risk_percent ?? 0) > settings.max_risk_per_trade,
    ).length,
  }
}

export function buildDailyRules(
  settings: UserSettingsForm,
  trades: SettingsTrade[],
  startingBalance: number,
): DailyRuleItem[] {
  const todayTrades = getTodayTrades(trades)
  const todayLossPercent = getTodayLossPercent(trades, startingBalance)
  const riskCompliant =
    todayTrades.length === 0 ||
    todayTrades.every((trade) => (trade.risk_percent ?? 0) <= settings.max_risk_per_trade)
  const tradesWithinLimit = todayTrades.length <= settings.max_trades_per_day
  const lossWithinLimit = todayLossPercent <= settings.daily_drawdown_limit
  const stopsSet =
    todayTrades.length === 0 ||
    todayTrades.every((trade) => trade.stop_loss != null && trade.stop_loss > 0)
  const noRevenge = !todayTrades.some((trade) => trade.emotion === "Revenge")
  const rulesFollowed =
    todayTrades.length === 0 || todayTrades.every((trade) => trade.rule_followed !== false)

  return [
    {
      id: "risk-limit",
      rule: `Risk per trade ≤ ${settings.max_risk_per_trade}%`,
      checked: riskCompliant,
    },
    {
      id: "trade-count",
      rule: `Max ${settings.max_trades_per_day} trades today (${todayTrades.length}/${settings.max_trades_per_day})`,
      checked: tradesWithinLimit,
    },
    {
      id: "daily-loss",
      rule: `Daily loss within ${settings.daily_drawdown_limit}% (${todayLossPercent.toFixed(1)}% used)`,
      checked: lossWithinLimit,
    },
    {
      id: "stop-loss",
      rule: "Stop loss set on every trade",
      checked: stopsSet,
    },
    {
      id: "no-revenge",
      rule: "No revenge trading today",
      checked: noRevenge,
    },
    {
      id: "rules",
      rule: "Trading plan followed",
      checked: rulesFollowed,
    },
  ]
}

export function getTradeRiskViolation(
  riskPercent: number | null | undefined,
  maxRiskPerTrade: number,
): string | null {
  if (riskPercent != null && riskPercent > maxRiskPerTrade) {
    return `Risk above ${maxRiskPerTrade}%`
  }
  return null
}
