export type TradingAccountType = "prop_firm" | "personal"

export type TradingAccountRecord = {
  id: string
  user_id: string
  name: string
  broker: string
  starting_balance: number
  account_type: TradingAccountType
  currency: string
  max_drawdown_pct: number
  starting_balance_locked: boolean
  is_default: boolean
  accent_color?: string | null
  max_trades_per_week?: number
  loss_streak_limit?: number
  min_emotional_score?: number
  cooldown_active?: boolean
  cooldown_triggered_at?: string | null
  last_coach_unlock_at?: string | null
  last_coach_unlock_session_id?: string | null
  created_at: string
  updated_at: string
}

export type TradingAccountInput = {
  name: string
  broker?: string
  starting_balance: number
  account_type?: TradingAccountType
  currency?: string
  max_drawdown_pct?: number
  max_trades_per_week?: number
  loss_streak_limit?: number
  min_emotional_score?: number
}

export type TradingAccountUpdate = Partial<TradingAccountInput> & {
  is_default?: boolean
}

export const ACCOUNT_TYPE_LABELS: Record<TradingAccountType, string> = {
  prop_firm: "Prop Firm",
  personal: "Personal",
}

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const
