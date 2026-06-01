import { ElevenLabsClient } from "elevenlabs"
import type { Readable } from "node:stream"
import type { CouncilAgentId, CouncilSettingsRecord } from "@/lib/council/types"
import {
  COUNCIL_TTS_MODEL,
  getCouncilVoiceTuning,
  isCouncilVoiceOutputConfigured,
  resolveCouncilVoiceId,
  type CouncilVoiceSettings,
} from "@/lib/council/voices"
import { formatCouncilSpeechText } from "@/lib/council/speech-text"

export function councilSettingsToVoiceMap(
  settings: CouncilSettingsRecord | null,
): CouncilVoiceSettings | null {
  if (!settings) return null
  return {
    nova_voice_id: settings.nova_voice_id,
    zara_voice_id: settings.zara_voice_id,
    rex_voice_id: settings.rex_voice_id,
    luna_voice_id: settings.luna_voice_id,
    cipher_voice_id: settings.cipher_voice_id,
    jarvis_voice_id: settings.jarvis_voice_id,
  }
}

export class CouncilVoiceNotConfiguredError extends Error {
  constructor() {
    super("ElevenLabs is not configured. Set ELEVENLABS_API_KEY in your environment.")
    this.name = "CouncilVoiceNotConfiguredError"
  }
}

let elevenLabsClient: ElevenLabsClient | null = null

function getElevenLabsClient(): ElevenLabsClient {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (!apiKey) throw new CouncilVoiceNotConfiguredError()

  if (!elevenLabsClient) {
    elevenLabsClient = new ElevenLabsClient({ apiKey })
  }

  return elevenLabsClient
}

async function readableToArrayBuffer(readable: Readable): Promise<ArrayBuffer> {
  const chunks: Buffer[] = []
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk))
  }
  const buffer = Buffer.concat(chunks)
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

export async function synthesizeCouncilSpeech(input: {
  agentId: CouncilAgentId
  text: string
  settings?: CouncilVoiceSettings | null
}): Promise<ArrayBuffer> {
  if (!isCouncilVoiceOutputConfigured()) {
    throw new CouncilVoiceNotConfiguredError()
  }

  const trimmed = input.text.trim()
  if (!trimmed) {
    throw new Error("Text is required for speech synthesis")
  }

  const speechText = formatCouncilSpeechText(trimmed)
  const voiceId = resolveCouncilVoiceId(input.agentId, input.settings)
  const voiceSettings = getCouncilVoiceTuning(input.agentId)
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || COUNCIL_TTS_MODEL

  const elevenlabs = getElevenLabsClient()
  const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
    text: speechText,
    model_id: modelId,
    output_format: "mp3_44100_128",
    voice_settings: {
      stability: voiceSettings.stability,
      similarity_boost: voiceSettings.similarity_boost,
      ...(voiceSettings.speed != null ? { speed: voiceSettings.speed } : {}),
    },
  })

  return readableToArrayBuffer(audioStream)
}
