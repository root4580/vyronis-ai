import { ElevenLabsClient } from "elevenlabs"
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
    jarvis_voice_id: settings.jarvis_voice_id,
    nova_voice_id: settings.nova_voice_id,
    zara_voice_id: settings.zara_voice_id,
    rex_voice_id: settings.rex_voice_id,
    luna_voice_id: settings.luna_voice_id,
    cipher_voice_id: settings.cipher_voice_id,
    marcus_voice_id: settings.marcus_voice_id,
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

async function streamToArrayBuffer(body: unknown): Promise<ArrayBuffer> {
  if (body instanceof ArrayBuffer) return body
  if (body instanceof Uint8Array) {
    return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer
  }

  if (body && typeof (body as ReadableStream<Uint8Array>).getReader === "function") {
    const reader = (body as ReadableStream<Uint8Array>).getReader()
    const chunks: Uint8Array[] = []
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value?.byteLength) chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
    const merged = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }
    return merged.buffer
  }

  if (
    body &&
    typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === "function"
  ) {
    const chunks: Uint8Array[] = []
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      if (typeof chunk === "string") {
        chunks.push(new TextEncoder().encode(chunk))
      } else if (chunk?.byteLength) {
        chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk))
      }
    }
    const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
    const merged = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }
    return merged.buffer
  }

  throw new Error("Unsupported ElevenLabs audio stream type")
}

function formatElevenLabsError(error: unknown): string {
  if (error instanceof Error) {
    const body = (error as Error & { body?: unknown }).body
    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail?: unknown }).detail
      if (typeof detail === "string") return detail
      if (detail && typeof detail === "object" && "message" in detail) {
        return String((detail as { message?: unknown }).message ?? error.message)
      }
    }
    return error.message
  }
  return "ElevenLabs speech synthesis failed"
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

  try {
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

    const audio = await streamToArrayBuffer(audioStream)
    if (audio.byteLength < 128) {
      throw new Error("ElevenLabs returned empty audio")
    }
    return audio
  } catch (error) {
    if (error instanceof CouncilVoiceNotConfiguredError) throw error
    throw new Error(formatElevenLabsError(error))
  }
}
