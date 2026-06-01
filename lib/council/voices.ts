import type { CouncilAgentId } from "@/lib/council/types"

/** ElevenLabs premade voices — override per agent via env or council_settings. */
export const DEFAULT_COUNCIL_VOICE_IDS: Record<CouncilAgentId, string> = {
  sarah: "21m00Tcm4TlvDq8ikWAM", // Rachel — calm female
  adam: "pNInz6obpgDQGcFmaJgB", // Adam — calm male
  scott: "TxGEqnHWrfWFTfGW9XjX", // Josh — confident male
  hamza: "ErXwobaYiN019PkySvjV", // Antoni — friendly male
  khalid: "2EiwWnXFnvU5JabPnv8n", // Clyde — direct male
}

const ENV_VOICE_KEYS: Record<CouncilAgentId, string> = {
  sarah: "ELEVENLABS_SARAH_VOICE_ID",
  adam: "ELEVENLABS_ADAM_VOICE_ID",
  scott: "ELEVENLABS_SCOTT_VOICE_ID",
  hamza: "ELEVENLABS_HAMZA_VOICE_ID",
  khalid: "ELEVENLABS_KHALID_VOICE_ID",
}

export type CouncilVoiceSettings = Partial<{
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
  const settingsKey = `${agentId}_voice_id` as const
  const fromSettings = settings?.[settingsKey]?.trim()
  if (fromSettings) return fromSettings

  const envKey = ENV_VOICE_KEYS[agentId]
  const fromEnv = process.env[envKey]?.trim()
  if (fromEnv) return fromEnv

  return DEFAULT_COUNCIL_VOICE_IDS[agentId]
}
