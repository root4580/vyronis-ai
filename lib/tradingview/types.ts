import type { SetupGrade } from "@/lib/strategy-brain/types"

export type TradingViewSignalStatus = "new" | "analyzed" | "converted" | "archived" | "ignored"

export type TradingViewAiRecommendation = "TAKE" | "CAUTION" | "SKIP"

export type TradingViewSetupVerdict = "trade_ready" | "tradable" | "wait" | "low_quality"

export type TradingViewWarRoomAlignment = {
  alignment_score: number
  pair_on_watchlist: boolean
  aoi_status: string | null
  pair_bias: string | null
  direction_aligned: boolean
  market_bias_aligned: boolean
  headline: string
  notes: string[]
}

export type TradingViewAlertPayload = {
  secret?: string
  symbol: string
  timeframe?: string | null
  direction: string
  strategy_name?: string | null
  entry_zone?: string | null
  stop_loss?: number | null
  take_profit?: number | null
  confidence?: number | null
  message?: string | null
  chart_url?: string | null
  /** Direct image URL (PNG/JPG) — TradingView cannot attach files; use a hosted image link if needed. */
  image_url?: string | null
  screenshot_url?: string | null
  alert_id?: string | null
}

export type TradingViewChartVisionSnapshot = {
  available: boolean
  image_source: "alert_image" | "war_room" | "alert_chart_url" | "none"
  image_url?: string
  vision_score?: number
  summary?: string
  warnings?: string[]
  strengths?: string[]
  skipped_reason?: string
  analyzed_at?: string
}

export type TradingViewTechnicalSignalAnalysis = {
  htf_alignment: { score: number; label: string; notes: string }
  risk_reward: { ratio: number | null; quality: "poor" | "acceptable" | "strong" }
  session_timing: { session: string; fits_preferred: boolean; notes: string }
  news_warning: { connected: false; message: string }
  confidence_score: number
  recommendation: TradingViewAiRecommendation
  summary: string
  warnings: string[]
  strengths: string[]
}

export type TradingViewWhyConfidenceCategory = {
  id: string
  label: string
  score: number
  note: string
}

export type TradingViewMemoryMatchKind =
  | "winner"
  | "loser"
  | "impulsive"
  | "high_confidence"

export type TradingViewMemoryMatch = {
  kind: TradingViewMemoryMatchKind
  trade_id: string
  pair: string
  result: string
  similarity_score: number
  summary: string
}

export type TradingViewMemorySimilarity = {
  historical_confidence: number
  overall_similarity: number
  matches: TradingViewMemoryMatch[]
  warnings: string[]
  narrative: string | null
}

export type TradingViewOutcomeLearning = {
  trade_id: string
  result?: string
  session_note?: string
  emotion?: string | null
  lesson?: string
  natural_reference?: string
  vyronis_was_right?: boolean | null
  synced_at: string
}

/** Structured reasoning layer — makes alert grading feel explainable, not opaque. */
export type TradingViewWhyEngine = {
  headline: string
  confidence_score: number
  confidence_categories: TradingViewWhyConfidenceCategory[]
  historical_confidence: number
  memory_similarity: TradingViewMemorySimilarity
  grade_passed: boolean
  setup_grade: SetupGrade
  setup_verdict: TradingViewSetupVerdict
  pass_reasons: string[]
  fail_reasons: string[]
  improvements: string[]
  strengths: string[]
  weaknesses: string[]
  warnings: string[]
  memory_insights: string[]
  recommendation: string
  /** Every ingested alert is stored for learning, including sub-B+ skips. */
  saved_for_training: boolean
  /** Multi-provider AI Router enrichment (when API keys are configured). */
  ai_router?: import("@/lib/ai/vyronis-ai-integration").VyronisAIEnrichment
}

export type TradingViewSignalAnalysis = TradingViewTechnicalSignalAnalysis & {
  war_room: TradingViewWarRoomAlignment
  setup_grade: SetupGrade
  setup_verdict: TradingViewSetupVerdict
  meets_minimum_grade: boolean
  verdict_summary: string
  why_engine?: TradingViewWhyEngine
  outcome_learning?: TradingViewOutcomeLearning
  chart_vision?: TradingViewChartVisionSnapshot
}

export type TradingViewSignalRecord = {
  id: string
  user_id: string
  symbol: string
  timeframe: string | null
  direction: string
  strategy_name: string | null
  entry_zone: string | null
  stop_loss: number | null
  take_profit: number | null
  confidence: number | null
  message: string | null
  chart_url: string | null
  raw_payload: Record<string, unknown>
  status: TradingViewSignalStatus
  read_at: string | null
  archived_at: string | null
  ai_analysis: TradingViewSignalAnalysis | null
  ai_confidence_score: number | null
  ai_recommendation: TradingViewAiRecommendation | null
  coach_session_id: string | null
  trade_id: string | null
  external_alert_id: string | null
  received_at: string
  analyzed_at: string | null
  created_at: string
  updated_at: string
}

export type TradingViewSignalListItem = Pick<
  TradingViewSignalRecord,
  | "id"
  | "symbol"
  | "timeframe"
  | "direction"
  | "strategy_name"
  | "entry_zone"
  | "stop_loss"
  | "take_profit"
  | "chart_url"
  | "message"
  | "ai_confidence_score"
  | "ai_recommendation"
  | "coach_session_id"
  | "read_at"
  | "received_at"
  | "status"
> & {
  ai_analysis?: TradingViewSignalAnalysis | null
}

export type TradingViewWebhookResult = {
  ok: boolean
  duplicate?: boolean
  rejected?: boolean
  reason?: "session" | "timeframe" | "bias"
  signalId?: string
  coachSessionId?: string
  tradePlanId?: string
  user_id?: string
  message?: string
  setup_grade?: string
  setup_verdict?: string
  email_sent?: boolean
  chart_vision_scheduled?: boolean
}
