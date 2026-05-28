/** Phase 8 — Voice & Real-Time Companion contracts (implementation roadmap) */

export type VoiceCompanionMode =
  | "calm"
  | "analytical"
  | "strict_funded_guardian"
  | "emotional_reset"
  | "reflective_mentor"

export type VoiceSessionIntent =
  | "live_prep"
  | "emotional_checkin"
  | "trade_reflection"
  | "session_review"
  | "voice_journal"
  | "proactive_warning"

export const VOICE_COMPANION_MODES: Record<VoiceCompanionMode, string> = {
  calm: "Calm, measured pacing — no urgency.",
  analytical: "Analytical walkthrough — structure first.",
  strict_funded_guardian: "Direct capital protection — short sentences.",
  emotional_reset: "Slow, validating reset — no trade pushing.",
  reflective_mentor: "Reflective questions — process over P&L.",
}

export const PHASE_8_VOICE_PIPELINE = {
  stt: "planned",
  tts: "planned",
  realtimeWebRtc: "planned",
  contextInjection: "partial",
  proactivePush: "planned",
} as const
