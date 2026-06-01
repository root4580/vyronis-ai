import type { CouncilAgentId, CouncilSettingsRecord } from "@/lib/council/types"
import {
  isCouncilVoiceOutputConfigured,
  resolveCouncilVoiceId,
  type CouncilVoiceSettings,
} from "@/lib/council/voices"

export function councilSettingsToVoiceMap(
  settings: CouncilSettingsRecord | null,
): CouncilVoiceSettings | null {
  if (!settings) return null
  return {
    sarah_voice_id: settings.sarah_voice_id,
    adam_voice_id: settings.adam_voice_id,
    scott_voice_id: settings.scott_voice_id,
    hamza_voice_id: settings.hamza_voice_id,
    khalid_voice_id: settings.khalid_voice_id,
  }
}

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech"

export class CouncilVoiceNotConfiguredError extends Error {
  constructor() {
    super("ElevenLabs is not configured. Set ELEVENLABS_API_KEY in your environment.")
    this.name = "CouncilVoiceNotConfiguredError"
  }
}

export async function synthesizeCouncilSpeech(input: {
  agentId: CouncilAgentId
  text: string
  settings?: CouncilVoiceSettings | null
}): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (!apiKey) throw new CouncilVoiceNotConfiguredError()

  const text = input.text.trim()
  if (!text) {
    throw new Error("Text is required for speech synthesis")
  }

  const voiceId = resolveCouncilVoiceId(input.agentId, input.settings)
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_turbo_v2_5"

  const response = await fetch(`${ELEVENLABS_TTS_URL}/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.2,
        use_speaker_boost: true,
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(
      detail.trim() || `ElevenLabs TTS failed (${response.status})`,
    )
  }

  return response.arrayBuffer()
}
