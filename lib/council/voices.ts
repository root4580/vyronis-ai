import type { CouncilAgentId } from "@/lib/council/types"

/** ElevenLabs premade voices — override per agent via env or council_settings. */
export const DEFAULT_COUNCIL_VOICE_IDS: Record<CouncilAgentId, string> = {
  jarvis: "TxGEqnHWrfWFTfGW9XjX", // Josh — same family as Rex; override via ELEVENLABS_JARVIS_VOICE_ID
  nova: "21m00Tcm4TlvDq8ikWAM", // Rachel — calm female
  zara: "pNInz6obpgDQGcFmaJgB", // Adam — calm male
  rex: "TxGEqnHWrfWFTfGW9XjX", // Josh — confident male
  luna: "ErXwobaYiN019PkySvjV", // Antoni — friendly male
  cipher: "2EiwWnXFnvU5JabPnv8n", // Clyde — direct male
  marcus: "nPczCjzI2devNBz1zQrb", // Brian — deep warm American male; override via ELEVENLABS_MARCUS_VOICE_ID
}

const ENV_VOICE_KEYS: Record<CouncilAgentId, string> = {
  jarvis: "ELEVENLABS_JARVIS_VOICE_ID",
  nova: "ELEVENLABS_NOVA_VOICE_ID",
  zara: "ELEVENLABS_ZARA_VOICE_ID",
  rex: "ELEVENLABS_REX_VOICE_ID",
  luna: "ELEVENLABS_LUNA_VOICE_ID",
  cipher: "ELEVENLABS_CIPHER_VOICE_ID",
  marcus: "ELEVENLABS_MARCUS_VOICE_ID",
}

const LEGACY_ENV_VOICE_KEYS: Partial<Record<CouncilAgentId, string[]>> = {
  nova: ["ELEVENLABS_SARAH_VOICE_ID"],
  zara: ["ELEVENLABS_ADAM_VOICE_ID"],
  rex: ["ELEVENLABS_SCOTT_VOICE_ID"],
  luna: ["ELEVENLABS_HAMZA_VOICE_ID"],
  cipher: ["ELEVENLABS_KHALID_VOICE_ID"],
}

export type CouncilVoiceSettings = Partial<{
  jarvis_voice_id: string | null
  nova_voice_id: string | null
  zara_voice_id: string | null
  rex_voice_id: string | null
  luna_voice_id: string | null
  cipher_voice_id: string | null
  marcus_voice_id: string | null
  sarah_voice_id: string | null
  adam_voice_id: string | null
  scott_voice_id: string | null
  hamza_voice_id: string | null
  khalid_voice_id: string | null
}>

export function isCouncilVoiceOutputConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim())
}

export function resolveCouncilVoiceId(
  agentId: CouncilAgentId,
  settings?: CouncilVoiceSettings | null,
): string {
  const settingsKey = `${agentId}_voice_id` as keyof CouncilVoiceSettings
  const fromSettings = settings?.[settingsKey]?.trim()
  if (fromSettings) return fromSettings

  const envKey = ENV_VOICE_KEYS[agentId]
  const fromEnv = process.env[envKey]?.trim()
  if (fromEnv) return fromEnv

  for (const legacyKey of LEGACY_ENV_VOICE_KEYS[agentId] ?? []) {
    const fromLegacyEnv = process.env[legacyKey]?.trim()
    if (fromLegacyEnv) return fromLegacyEnv
  }

  return DEFAULT_COUNCIL_VOICE_IDS[agentId]
}

export type CouncilVoiceTuning = {
  stability: number
  similarity_boost: number
  speed?: number
}

export const COUNCIL_TTS_MODEL = "eleven_multilingual_v2"

export const COUNCIL_VOICE_TUNING: Record<CouncilAgentId, CouncilVoiceTuning> = {
  jarvis: { stability: 0.85, similarity_boost: 0.9, speed: 0.95 },
  nova: { stability: 0.7, similarity_boost: 0.8 },
  zara: { stability: 0.4, similarity_boost: 0.9 },
  luna: { stability: 0.5, similarity_boost: 0.8 },
  rex: { stability: 0.8, similarity_boost: 0.9 },
  cipher: { stability: 0.9, similarity_boost: 0.9 },
  marcus: { stability: 0.75, similarity_boost: 0.85, speed: 0.92 },
}

export function getCouncilVoiceTuning(agentId: CouncilAgentId): CouncilVoiceTuning {
  return COUNCIL_VOICE_TUNING[agentId]
}
