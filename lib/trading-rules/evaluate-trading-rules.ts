import { getWeekTradeBounds } from "@/lib/hq-dashboard-metrics"
import { isTradeInTradingWeek } from "@/lib/trading/trading-week"
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
  const { start, end } = getWeekTradeBounds(now)
  return isTradeInTradingWeek(trade, start, end)
}

/** Live trades that count toward this week's rules (Sunday 5:00 PM ET → Friday 4:59 PM ET). */
export function filterTradesForRulesWeek(
  trades: TradingRulesTradeRow[],
  referenceDate = new Date(),
): TradingRulesTradeRow[] {
  return trades.filter((trade) => isTradeInCurrentWeek(trade, referenceDate))
}

export function countTradesThisWeek(
  trades: TradingRulesTradeRow[],
  now = new Date(),
): number {
  return filterTradesForRulesWeek(trades, now).length
}

function sortTradesNewestFirst(trades: TradingRulesTradeRow[]): TradingRulesTradeRow[] {
  return [...trades].sort((a, b) => {
    const da = a.trade_date ?? a.created_at ?? ""
    const db = b.trade_date ?? b.created_at ?? ""
    return db.localeCompare(da)
  })
}

/** Consecutive losses from most recent trade backward (caller should pass week-scoped trades). */
export function getRecentLossStreakForRules(trades: TradingRulesTradeRow[]): number {
  const sorted = sortTradesNewestFirst(trades)
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

export function getCurrentWeekLossStreak(
  trades: TradingRulesTradeRow[],
  referenceDate = new Date(),
): number {
  return getRecentLossStreakForRules(filterTradesForRulesWeek(trades, referenceDate))
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

export function isCooldownBlocking(input: {
  streakHitsLimit: boolean
  cooldown: AccountCooldownState
}): boolean {
  if (!input.streakHitsLimit) return false

  const { cooldown } = input
  if (
    cooldown.last_coach_unlock_at &&
    cooldown.cooldown_triggered_at &&
    new Date(cooldown.last_coach_unlock_at) >= new Date(cooldown.cooldown_triggered_at)
  ) {
    return false
  }

  return cooldown.cooldown_active || input.streakHitsLimit
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
  const weekTrades = filterTradesForRulesWeek(input.trades, referenceDate)
  const lossStreak = getRecentLossStreakForRules(weekTrades)
  const tradesThisWeek = weekTrades.length
  const weeklyLimitReached = tradesThisWeek >= rules.max_trades_per_week
  const streakHitsLimit = shouldTriggerCooldown(lossStreak, rules)
  const cooldownRequired = isCooldownBlocking({ streakHitsLimit, cooldown })

  let blockReason: string | null = null
  if (cooldownRequired) {
    blockReason =
      lossStreak >= rules.loss_streak_limit
        ? `${lossStreak} consecutive losses this week — complete Cooldown Coach before your next live trade.`
        : `${rules.loss_streak_limit} losses in a row — complete Cooldown Coach before your next live trade.`
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
  referenceDate?: Date
}): { cooldownActive: boolean; triggeredAt: string | null } {
  const referenceDate = input.referenceDate ?? new Date()

  if (isWinningTrade(input.latestTrade)) {
    return { cooldownActive: false, triggeredAt: null }
  }

  const weekTrades = filterTradesForRulesWeek(input.tradesAfterInsert, referenceDate)
  const lossStreak = getRecentLossStreakForRules(weekTrades)
  if (shouldTriggerCooldown(lossStreak, input.rules)) {
    return { cooldownActive: true, triggeredAt: new Date().toISOString() }
  }

  return { cooldownActive: false, triggeredAt: null }
}

export function shouldClearStaleCooldown(input: {
  snapshot: TradingRulesSnapshot
  accountCooldownActive: boolean
}): boolean {
  return input.accountCooldownActive && !input.snapshot.cooldownRequired
}
