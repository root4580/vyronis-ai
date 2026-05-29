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

export type TradingViewSignalAnalysis = TradingViewTechnicalSignalAnalysis & {
  war_room: TradingViewWarRoomAlignment
  setup_grade: SetupGrade
  setup_verdict: TradingViewSetupVerdict
  meets_minimum_grade: boolean
  verdict_summary: string
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
  signalId?: string
  coachSessionId?: string
  user_id?: string
  message?: string
  setup_grade?: string
  setup_verdict?: string
  email_sent?: boolean
  chart_vision_scheduled?: boolean
}
