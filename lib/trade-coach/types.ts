import type {
  TradeQualityBreakdown,
  TradeQualityGrade,
  TradeQualityRecommendation,
  TradeQualityResult,
} from "@/lib/trade-coach/trade-quality-engine"

export type CoachSessionStatus = "in_progress" | "completed" | "linked"

export type CoachMessageRole = "coach" | "user"

export type PreTradeQuestionType = "text" | "select" | "boolean"

export type PreTradePlannedContext = {
  pair?: string
  direction?: string
  setup?: string
  strategy_name?: string | null
  risk_percent?: string
  session?: string
  entry_price?: string
  stop_loss?: string
  take_profit?: string
  emotion?: string
  rule_followed?: boolean
  trade_date?: string
  confirmation_signal?: string | null
  higher_timeframe?: string
  entry_timeframe?: string
  confirmation_timeframe?: string
  strategy_playbook_id?: string | null
  playbook_match?: import("@/lib/strategy/types").StrategyPlaybookMatchResult
  chart_url?: string
  screenshot_url?: string | null
  vision_score?: number | null
  max_risk_per_trade?: number
  coach_analysis?: PreTradeAnalysis
  chart_analysis?: ChartAnalysisResult
  mtf_analysis?: import("@/lib/coach/mtf-types").MtfAnalysisResult
  visual_analysis?: import("@/lib/coach/visual-analysis-types").VisualAnalysisResult
  chart_annotations?: import("@/lib/chart-annotations/types").ChartAnnotationBundle
  bias_alignment_score?: number | null
  entry_confirmation_score?: number | null
  signal_source?: "tradingview" | "manual"
  tradingview_signal_id?: string
  /** Command Center multi-image timeframe bundle session id */
  timeframe_bundle_id?: string
  timeframe_bundle?: {
    sessionId: string
    imageUrls: string[]
    inferredStack: string
    comparisonSummary: string
    frames: Array<{
      index: number
      imageUrl: string
      inferredTimeframe: string
      displayLabel: string
    }>
  }
}

export type ChartAnalysisResult = {
  overallScore: number
  executionQuality: number
  trendAlignment: number
  confirmationStrength: number
  rrQuality: number
  countertrend: boolean
  overextendedEntry: boolean
  warnings: string[]
  strengths: string[]
  summary: string
  insights: string[]
  vision?: import("@/lib/coach/types").ChartVisionResult
  mtf?: import("@/lib/coach/mtf-types").MtfAnalysisResult
}

export type CoachRedFlagId =
  | "euphoric"
  | "revenge"
  | "fomo"
  | "over_risking"
  | "countertrend"
  | "rules_break"
  | "emotional_risk"

export type CoachRedFlag = {
  id: CoachRedFlagId
  severity: "warning" | "critical"
  message: string
}

export type PreTradeAnalysis = {
  confidenceScore: number
  shouldTakeTrade: "yes" | "caution" | "no"
  summary: string
  redFlags: CoachRedFlag[]
  insights: string[]
  tradeQuality?: TradeQualityResult
}

export type {
  TradeQualityBreakdown,
  TradeQualityGrade,
  TradeQualityRecommendation,
  TradeQualityResult,
} from "@/lib/trade-coach/trade-quality-engine"

export type CoachInsightLabel =
  | "You broke your rules"
  | "Good patience"
  | "FOMO detected"
  | "Risk managed well"
  | string

export type PreTradeQuestion = {
  key: string
  prompt: string
  placeholder?: string
  type: PreTradeQuestionType
  options?: string[]
  required?: boolean
}

export type TradeCoachSessionRecord = {
  id: string
  user_id: string
  trade_id: string | null
  status: CoachSessionStatus
  planned_context: PreTradePlannedContext
  quality_score?: number | null
  quality_grade?: TradeQualityGrade | null
  recommendation?: TradeQualityRecommendation | null
  confidence_score?: number | null
  score_breakdown?: TradeQualityBreakdown | null
  warnings?: string[] | null
  strengths?: string[] | null
  quality_override?: boolean | null
  quality_override_at?: string | null
  chart_url?: string | null
  screenshot_url?: string | null
  chart_analysis?: ChartAnalysisResult | import("@/lib/coach/types").ChartVisionResult | null
  vision_score?: number | null
  weekly_screenshot_url?: string | null
  daily_screenshot_url?: string | null
  h4_screenshot_url?: string | null
  h1_screenshot_url?: string | null
  m15_screenshot_url?: string | null
  mtf_analysis?: import("@/lib/coach/mtf-types").MtfAnalysisResult | null
  visual_analysis?: import("@/lib/coach/visual-analysis-types").VisualAnalysisResult | null
  chart_annotations?: import("@/lib/chart-annotations/types").ChartAnnotationBundle | null
  vision_provider?: string | null
  vision_analyzed_at?: string | null
  bias_alignment_score?: number | null
  entry_confirmation_score?: number | null
  created_at: string
  updated_at: string
}

export type TradeCoachMessageRecord = {
  id: string
  session_id: string
  user_id: string
  role: CoachMessageRole
  question_key: string | null
  content: string
  step_index: number
  created_at: string
}

export type PlannedVsActualComparison = {
  field: string
  planned: string
  actual: string
  aligned: boolean
  note: string
}

export type DisciplineAnalysis = {
  score: number
  strengths: string[]
  weaknesses: string[]
  ruleAdherence: "strong" | "mixed" | "weak"
  emotionalControl: "stable" | "mixed" | "risky"
  coachingInsights?: CoachInsightLabel[]
}

export type TradeCoachFeedbackRecord = {
  id: string
  user_id: string
  session_id: string | null
  trade_id: string
  planned_vs_actual: PlannedVsActualComparison[]
  discipline_analysis: DisciplineAnalysis
  coaching_summary: string
  feedback_points: string[]
  discipline_score: number
  created_at: string
  updated_at: string
}

export type TradeCoachSessionWithMessages = TradeCoachSessionRecord & {
  messages: TradeCoachMessageRecord[]
}

export type PostTradeCoachInput = {
  trade: {
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
    trade_date?: string | null
    created_at?: string
    confirmation_signal?: string | null
    trade_notes?: string | null
    mistake_tags?: string | null
    entry_price?: number | null
    stop_loss?: number | null
    take_profit?: number | null
    risk_reward?: number | null
  }
  preTradeResponses: Record<string, string>
  plannedContext: PreTradePlannedContext
  maxRiskPerTrade: number
}

export type PostTradeCoachResult = {
  plannedVsActual: PlannedVsActualComparison[]
  disciplineAnalysis: DisciplineAnalysis
  coachingSummary: string
  feedbackPoints: string[]
  coachingInsights: CoachInsightLabel[]
  disciplineScore: number
}

export type CoachSessionHistoryItem = {
  id: string
  status: CoachSessionStatus
  trade_id: string | null
  pair: string | null
  direction: string | null
  confidence_score: number | null
  should_take_trade: string | null
  trade_result: string | null
  discipline_score: number | null
  created_at: string
  updated_at: string
}

export type PlannedCoachSessionItem = {
  id: string
  status: CoachSessionStatus
  pair: string | null
  direction: string | null
  risk: string | null
  emotion: string | null
  plan_summary: string
  confidence_score: number | null
  should_take_trade: string | null
  signal_source?: "tradingview" | "manual" | null
  strategy_name?: string | null
  timeframe?: string | null
  ai_recommendation?: string | null
  created_at: string
  updated_at: string
}
