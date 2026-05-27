import type {
  SetupCoachingInsight,
  SetupScoreBreakdown,
} from "@/lib/trade-coach/setup-score-engine"

export type AnalyticsTradeRow = {
  id: string
  pair: string
  direction: string
  result: string
  pnl: number
  emotion: string
  emotion_after?: string | null
  setup: string
  strategy_name: string | null
  risk_percent: number | null
  rule_followed: boolean | null
  session: string | null
  trade_date: string | null
  created_at: string
  higher_timeframe?: string | null
  entry_timeframe?: string | null
  confirmation_timeframe?: string | null
  confirmation_signal?: string | null
  mistake_tags?: string | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
  risk_reward?: number | null
  setup_score?: number | null
  setup_classification?: string | null
  setup_score_breakdown?: SetupScoreBreakdown | null
  setup_coaching_insights?: SetupCoachingInsight[] | null
  research_strategy_id?: string | null
  import_source?: string | null
  import_batch_id?: string | null
  external_ticket?: string | null
  closed_at?: string | null
  opened_at?: string | null
  lots?: number | null
  commission?: number | null
  swap?: number | null
}

export type SetupDisplayBucket = "A+" | "A" | "B" | "C"

export type SetupBreakdownItem = {
  bucket: SetupDisplayBucket
  count: number
  percentage: number
  color: string
}

export type EmotionFrequencyItem = {
  emotion: string
  count: number
  percentage: number
}

export type EquityCurvePoint = {
  date: string
  equity: number
  pnl: number
}

export type WeeklyTrendPoint = {
  week: string
  pnl: number
  trades: number
  winRate: number
}

export type DashboardAnalyticsSnapshot = {
  hasData: boolean
  tradeCount: number
  winRate: number
  totalPnL: number
  averageRR: number
  bestSession: { name: string; pnl: number; winRate: number; tradeCount: number } | null
  bestPair: { pair: string; pnl: number; winRate: number; tradeCount: number } | null
  topMistake: { label: string; count: number; frequency: number } | null
  emotionFrequency: EmotionFrequencyItem[]
  setupBreakdown: SetupBreakdownItem[]
  equityCurve: EquityCurvePoint[]
  weeklyTrend: WeeklyTrendPoint[]
  wins: number
  losses: number
}
