export type TradingViewSignalStatus = "new" | "analyzed" | "converted" | "archived" | "ignored"

export type TradingViewAiRecommendation = "TAKE" | "CAUTION" | "SKIP"

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
  alert_id?: string | null
}

export type TradingViewSignalAnalysis = {
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
>

export type TradingViewWebhookResult = {
  ok: boolean
  duplicate?: boolean
  signalId?: string
  coachSessionId?: string
  message?: string
}
