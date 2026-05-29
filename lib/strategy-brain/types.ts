/** Discretionary forex strategy doctrine — Top-Down AOI (Vyronis playbook). */

export type BiasDirection = "Bullish" | "Bearish" | "Neutral"

export type AoiStatus = "WAITING" | "INSIDE_AOI" | "CONFIRMING" | "INVALIDATED"

export type SetupGrade = "A+" | "B" | "C" | "D"

export type TradeRecommendation = "TAKE" | "CAUTION" | "SKIP"

export type MarketBiasRecord = {
  user_id: string
  weekly_bias: BiasDirection
  daily_bias: BiasDirection
  h4_bias: BiasDirection
  directional_permission: boolean
  setup_valid: boolean
  conflict_summary: string | null
  updated_at: string
}

export type MarketBiasInput = {
  weekly_bias: BiasDirection
  daily_bias: BiasDirection
  h4_bias: BiasDirection
}

export type MarketBiasEvaluation = {
  weekly_bias: BiasDirection
  daily_bias: BiasDirection
  h4_bias: BiasDirection
  directional_permission: boolean
  setup_valid: boolean
  conflict_summary: string | null
  alignment_summary: string
}

export type WeeklyPlanRecord = {
  id: string
  user_id: string
  week_start: string
  session_notes: string
  session_focus: string
  expected_scenarios: string
  created_at: string
  updated_at: string
}

export type PairPlanRecord = {
  id: string
  user_id: string
  plan_id: string
  pair: string
  directional_bias: BiasDirection
  aoi_high: number | null
  aoi_low: number | null
  invalidation: number | null
  weekly_thesis: string
  notes: string
  aoi_status: AoiStatus
  screenshot_urls: string[]
  sort_order: number
  created_at: string
  updated_at: string
}

export type WeeklyPlanWithPairs = WeeklyPlanRecord & {
  pairs: PairPlanRecord[]
}

export type PairPlanInput = {
  pair: string
  directional_bias?: BiasDirection
  aoi_high?: number | null
  aoi_low?: number | null
  invalidation?: number | null
  weekly_thesis?: string
  notes?: string
  aoi_status?: AoiStatus
  screenshot_urls?: string[]
  sort_order?: number
}

export type ConfirmationChecklist = {
  break_and_retest: boolean | "borderline"
  ltf_structure_shift: boolean | "borderline"
  momentum_confirmation: boolean | "borderline"
  ema_confirmation: boolean | "borderline"
  clear_invalidation: boolean | "borderline"
  acceptable_rr: boolean | "borderline"
}

export type ConfirmationEvaluation = {
  checklist: ConfirmationChecklist
  missing: string[]
  borderline: string[]
  setup_strength: "strong" | "moderate" | "weak"
  summary: string
}

export type ScoringRuleKey =
  | "weekly_aligned"
  | "daily_aligned"
  | "h4_aligned"
  | "aoi_reached"
  | "momentum_confirmation"
  | "ema_confirmation"
  | "clear_invalidation"
  | "good_rr"
  | "emotion_stable"
  | "no_news_danger"

export type ScoringBreakdown = Record<ScoringRuleKey, number>

export type ScoringInput = {
  marketBias: MarketBiasEvaluation
  pairBias: BiasDirection
  confirmation: ConfirmationChecklist
  aoiReached: boolean
  riskReward: number | null
  emotionScore: number | null
  majorNewsRisk: boolean
}

export type ScoringResult = {
  totalScore: number
  maxScore: number
  grade: SetupGrade
  breakdown: ScoringBreakdown
  borderlineCount: number
  borderlineItems: string[]
  recommendation: TradeRecommendation
  recommendationReason: string
}

export type EmotionCheckAnswers = {
  calm: boolean
  fomo: boolean
  chasing: boolean
  revenge: boolean
  emotion_stable: boolean
  major_news: boolean
}

export type EmotionCheckResult = {
  emotion_score: number
  emotion_stable: boolean
  major_news_risk: boolean
  flags: string[]
  coach_message: string
}

export type PostTradeReviewAnswers = {
  followed_strategy: boolean | null
  valid_loss: boolean | null
  confirmation_clear: boolean | null
  entry_timing: "early" | "on_time" | "late" | null
  issue_type: "strategy" | "execution" | "both" | "neither" | null
  should_repeat: string
  should_change: string
}

export type TradeMemoryTrade = {
  id: string
  pair: string
  direction: string
  result: string
  pnl: number
  emotion: string | null
  setup: string | null
  confirmation_signal: string | null
  mistake_tags: string | null
  trade_date: string | null
}

export type StrategySetupEvaluationInput = {
  pair: string
  trade_direction?: "Long" | "Short"
  pair_plan_id?: string | null
  market_bias?: MarketBiasInput
  pair_bias?: BiasDirection
  confirmation: ConfirmationChecklist
  aoi_reached?: boolean
  risk_reward?: number | null
  emotion_answers?: EmotionCheckAnswers | null
  save_snapshot?: boolean
}

export type StrategySetupEvaluationResult = {
  marketBias: MarketBiasEvaluation
  confirmation: ConfirmationEvaluation
  scoring: ScoringResult
  memoryInsight: string | null
  evaluationId?: string
}

export type StrategyBrainDashboard = {
  marketBias: MarketBiasRecord | null
  currentWeekPlan: WeeklyPlanWithPairs | null
  weekStart: string
  recentEvaluations: Array<{
    id: string
    pair: string
    total_score: number
    grade: string
    recommendation: string
    created_at: string
  }>
}
