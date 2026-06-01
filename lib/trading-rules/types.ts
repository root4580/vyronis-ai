export type AccountTradingRules = {
  max_trades_per_week: number
  loss_streak_limit: number
  min_emotional_score: number
}

export type AccountCooldownState = {
  cooldown_active: boolean
  cooldown_triggered_at: string | null
  last_coach_unlock_at: string | null
  last_coach_unlock_session_id: string | null
}

export type TradingRulesSnapshot = {
  accountId: string
  rules: AccountTradingRules
  cooldown: AccountCooldownState
  lossStreak: number
  tradesThisWeek: number
  weeklyLimitReached: boolean
  cooldownRequired: boolean
  canLogTrade: boolean
  canSavePlan: boolean
  canOpenPreTradeCoach: boolean
  tradesRemainingThisWeek: number
  weeklyUsageLabel: string
  cooldownStatusLabel: "Active" | "Clear"
  blockReason: string | null
}

export type CooldownUnlockAnswers = {
  lossCause: string
  changePlan: string
  emotionalScore: number
}

export type CooldownUnlockResult = {
  unlocked: boolean
  message: string
  sessionId?: string
  emotionalScore: number
  minRequired: number
}

export const DEFAULT_ACCOUNT_TRADING_RULES: AccountTradingRules = {
  max_trades_per_week: 2,
  loss_streak_limit: 3,
  min_emotional_score: 7,
}
