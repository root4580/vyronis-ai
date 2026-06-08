import { toFile } from "openai"
import { getOpenAiClient, isOpenAiConfigured } from "@/lib/ai/providers/openai-provider"
import { filterCouncilTranscription } from "@/lib/council/voice-only-input"

export class CouncilListenNotConfiguredError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not configured for voice input.")
    this.name = "CouncilListenNotConfiguredError"
  }
}

export function isCouncilListenConfigured(): boolean {
  return isOpenAiConfigured()
}

export async function transcribeCouncilAudio(input: {
  buffer: Buffer
  filename: string
  mimeType: string
}): Promise<string> {
  const openai = getOpenAiClient()
  if (!openai) throw new CouncilListenNotConfiguredError()

  const file = await toFile(input.buffer, input.filename, { type: input.mimeType })
  const model = process.env.OPENAI_WHISPER_MODEL?.trim() || "whisper-1"

  const result = await openai.audio.transcriptions.create({
    model,
    file,
    language: "en",
  })

  const text = result.text?.trim()
  if (!text) {
    throw new Error("Whisper returned empty transcription")
  }

  const filtered = filterCouncilTranscription(text)
  if (!filtered) {
    throw new Error("No clear speech detected")
  }

  return filtered
}
