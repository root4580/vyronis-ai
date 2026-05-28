/**
 * Long-term integration contracts — implement incrementally.
 * Voice, mobile, TradingView live, MT5, streaming coach, AI replay.
 */

export type VyronisSurface = "web" | "mobile" | "voice" | "mt5" | "tradingview"

export type RealtimeCoachEvent =
  | { type: "shadow_update"; payload: Record<string, unknown> }
  | { type: "session_shift"; payload: Record<string, unknown> }
  | { type: "nudge"; message: string; priority: string }
  | { type: "reflection"; lesson: string }

export type StreamingCoachOptions = {
  surface: VyronisSurface
  threadId: string
  onToken?: (chunk: string) => void
  onEvent?: (event: RealtimeCoachEvent) => void
}

/** Placeholder for voice mode — wire to companion LLM + TTS when ready */
export type VoiceCoachSession = {
  sessionId: string
  startedAt: string
  shadowSnapshot?: Record<string, unknown>
}

/** MT5 bridge — partial via experts + future telemetry table */
export type Mt5ExecutionTelemetry = {
  ticket: number
  symbol: string
  plannedSl: number
  actualSl: number
  slippagePips: number
  emotionTag?: string
}
