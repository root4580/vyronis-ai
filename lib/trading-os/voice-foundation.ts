import type { VoiceCompanionFoundation } from "@/lib/trading-os/types"

export const VOICE_COMPANION_CAPABILITIES: VoiceCompanionFoundation["capabilities"] = [
  {
    id: "realtime_conversation",
    label: "Real-time voice coaching",
    status: "planned",
    description: "Live Command Center voice thread with cognitive + trading OS context.",
  },
  {
    id: "voice_journal",
    label: "Voice journaling",
    status: "planned",
    description: "Post-trade and mid-session voice notes synced to intelligence timeline.",
  },
  {
    id: "live_coaching",
    label: "Live coaching alerts",
    status: "partial",
    description: "Text proactive alerts active; voice delivery hooks prepared.",
  },
  {
    id: "post_session_review",
    label: "Post-session review calls",
    status: "planned",
    description: "End-of-session debrief using evolution + replay summaries.",
  },
]

export function buildVoiceCompanionFoundation(): VoiceCompanionFoundation {
  return {
    capabilities: VOICE_COMPANION_CAPABILITIES,
    sessionContractVersion: 1,
    supportedIntents: [
      "market_check",
      "pre_trade_coaching",
      "post_trade_review",
      "emotional_check_in",
      "intervention_ack",
      "replay_question",
    ],
    realtimeReady: false,
  }
}
