/**
 * Cognitive Architecture — long-term surface contracts
 */

export type CognitiveSurface = "web" | "mobile" | "voice" | "wearable" | "mt5" | "tv"

export type CognitiveStreamEvent =
  | { type: "state_shift"; state: string; strictness: number }
  | { type: "confidence_gap"; phase: string; gap: number }
  | { type: "market_shift"; environment: string }
  | { type: "prediction_alert"; message: string }
  | { type: "replay_ready"; tradeId: string; summary: string }

export type VoiceCognitiveSession = {
  sessionId: string
  coachingMode: string
  cognitiveState: string
  startedAt: string
}
