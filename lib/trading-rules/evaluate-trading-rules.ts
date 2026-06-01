import { getWeekTradeBounds } from "@/lib/hq-dashboard-metrics"
import { getSignedPnL } from "@/lib/trade-utils"
import type { SettingsTrade } from "@/lib/user-settings"
import {
  DEFAULT_ACCOUNT_TRADING_RULES,
  type AccountCooldownState,
  type AccountTradingRules,
  type TradingRulesSnapshot,
} from "@/lib/trading-rules/types"

export type TradingRulesTradeRow = Pick<
  SettingsTrade,
  "trade_date" | "created_at" | "pnl" | "result"
>

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

export function countTradesThisWeek(
  trades: TradingRulesTradeRow[],
  now = new Date(),
): number {
  return trades.filter((trade) => isTradeInCurrentWeek(trade, now)).length
}

export function getRecentLossStreakForRules(trades: TradingRulesTradeRow[]): number {
  const sorted = [...trades].sort((a, b) => {
    const da = a.trade_date ?? a.created_at ?? ""
    const db = b.trade_date ?? b.created_at ?? ""
    return db.localeCompare(da)
  })
  let streak = 0
  for (const trade of sorted) {
    const signed = getSignedPnL(trade.pnl, trade.result)
    if (signed < 0) {
      streak++
      continue
    }
    if (trade.result?.toUpperCase() === "BREAKEVEN") continue
    break
  }
  return streak
}

export function isWinningTrade(trade: TradingRulesTradeRow): boolean {
  const signed = getSignedPnL(trade.pnl, trade.result)
  if (signed > 0) return true
  return trade.result?.toUpperCase() === "WIN"
}

export function shouldTriggerCooldown(
  lossStreak: number,
  rules: AccountTradingRules,
): boolean {
  return lossStreak >= rules.loss_streak_limit
}

export function evaluateTradingRules(input: {
  accountId: string
  rules?: Partial<AccountTradingRules>
  cooldown?: Partial<AccountCooldownState>
  trades: TradingRulesTradeRow[]
  referenceDate?: Date
}): TradingRulesSnapshot {
  const rules: AccountTradingRules = {
    ...DEFAULT_ACCOUNT_TRADING_RULES,
    ...input.rules,
  }
  const cooldown: AccountCooldownState = {
    cooldown_active: Boolean(input.cooldown?.cooldown_active),
    cooldown_triggered_at: input.cooldown?.cooldown_triggered_at ?? null,
    last_coach_unlock_at: input.cooldown?.last_coach_unlock_at ?? null,
    last_coach_unlock_session_id: input.cooldown?.last_coach_unlock_session_id ?? null,
  }

  const referenceDate = input.referenceDate ?? new Date()
  const lossStreak = getRecentLossStreakForRules(input.trades)
  const tradesThisWeek = countTradesThisWeek(input.trades, referenceDate)
  const weeklyLimitReached = tradesThisWeek >= rules.max_trades_per_week
  const cooldownRequired =
    cooldown.cooldown_active || shouldTriggerCooldown(lossStreak, rules)

  let blockReason: string | null = null
  if (cooldownRequired) {
    blockReason = `${rules.loss_streak_limit} losses in a row — complete Cooldown Coach before your next trade.`
  } else if (weeklyLimitReached) {
    blockReason = "Weekly trade limit reached. Come back next week."
  }

  const canLogTrade = !cooldownRequired && !weeklyLimitReached
  const canSavePlan = canLogTrade
  const canOpenPreTradeCoach = canLogTrade

  const tradesRemainingThisWeek = Math.max(0, rules.max_trades_per_week - tradesThisWeek)

  return {
    accountId: input.accountId,
    rules,
    cooldown,
    lossStreak,
    tradesThisWeek,
    weeklyLimitReached,
    cooldownRequired,
    canLogTrade,
    canSavePlan,
    canOpenPreTradeCoach,
    tradesRemainingThisWeek,
    weeklyUsageLabel: `${tradesThisWeek} of ${rules.max_trades_per_week} trades used this week`,
    cooldownStatusLabel: cooldownRequired ? "Active" : "Clear",
    blockReason,
  }
}

export function resolveCooldownAfterTrade(input: {
  rules: AccountTradingRules
  tradesAfterInsert: TradingRulesTradeRow[]
  latestTrade: TradingRulesTradeRow
}): { cooldownActive: boolean; triggeredAt: string | null } {
  if (isWinningTrade(input.latestTrade)) {
    return { cooldownActive: false, triggeredAt: null }
  }

  const lossStreak = getRecentLossStreakForRules(input.tradesAfterInsert)
  if (shouldTriggerCooldown(lossStreak, input.rules)) {
    return { cooldownActive: true, triggeredAt: new Date().toISOString() }
  }

  return { cooldownActive: false, triggeredAt: null }
}
