import type { CouncilAgentId } from "@/lib/council/types"

/** ElevenLabs premade voices — override per agent via env or council_settings. */
export const DEFAULT_COUNCIL_VOICE_IDS: Record<CouncilAgentId, string> = {
  nova: "21m00Tcm4TlvDq8ikWAM", // Rachel — calm female
  zara: "pNInz6obpgDQGcFmaJgB", // Adam — calm male
  rex: "TxGEqnHWrfWFTfGW9XjX", // Josh — confident male
  luna: "ErXwobaYiN019PkySvjV", // Antoni — friendly male
  cipher: "2EiwWnXFnvU5JabPnv8n", // Clyde — direct male
}

const ENV_VOICE_KEYS: Record<CouncilAgentId, string> = {
  nova: "ELEVENLABS_NOVA_VOICE_ID",
  zara: "ELEVENLABS_ZARA_VOICE_ID",
  rex: "ELEVENLABS_REX_VOICE_ID",
  luna: "ELEVENLABS_LUNA_VOICE_ID",
  cipher: "ELEVENLABS_CIPHER_VOICE_ID",
}

const LEGACY_ENV_VOICE_KEYS: Partial<Record<CouncilAgentId, string[]>> = {
  nova: ["ELEVENLABS_SARAH_VOICE_ID"],
  zara: ["ELEVENLABS_ADAM_VOICE_ID"],
  rex: ["ELEVENLABS_SCOTT_VOICE_ID"],
  luna: ["ELEVENLABS_HAMZA_VOICE_ID"],
  cipher: ["ELEVENLABS_KHALID_VOICE_ID"],
}

export type CouncilVoiceSettings = Partial<{
  nova_voice_id: string | null
  zara_voice_id: string | null
  rex_voice_id: string | null
  luna_voice_id: string | null
  cipher_voice_id: string | null
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
