import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  CouncilListenNotConfiguredError,
  transcribeCouncilAudio,
} from "@/lib/council/whisper-service"

const MAX_AUDIO_BYTES = 12 * 1024 * 1024

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm"
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a"
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3"
  if (mimeType.includes("wav")) return "wav"
  return "webm"
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const audio = formData.get("audio")

    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "Audio recording is required" }, { status: 400 })
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Recording is too long" }, { status: 413 })
    }

    const mimeType = audio.type || "audio/webm"
    const buffer = Buffer.from(await audio.arrayBuffer())
    const text = await transcribeCouncilAudio({
      buffer,
      filename: `council-${Date.now()}.${extensionForMime(mimeType)}`,
      mimeType,
    })

    return NextResponse.json({ text })
  } catch (error) {
    if (error instanceof CouncilListenNotConfiguredError) {
      return NextResponse.json({ error: error.message, listenConfigured: false }, { status: 503 })
    }
    console.error("Council listen POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not transcribe audio" },
      { status: 500 },
    )
  }
}
