import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  CouncilVoiceNotConfiguredError,
  synthesizeCouncilSpeech,
} from "@/lib/council/elevenlabs-service"
import { isCouncilVoiceOutputConfigured } from "@/lib/council/voices"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const configured = isCouncilVoiceOutputConfigured()
    if (!configured) {
      return NextResponse.json({
        voiceConfigured: false,
        ok: false,
        error: "ELEVENLABS_API_KEY is not set on the server. Add it in Vercel and redeploy.",
      })
    }

    const audio = await synthesizeCouncilSpeech({
      agentId: "jarvis",
      text: "Council voice check.",
    })

    return NextResponse.json({
      voiceConfigured: true,
      ok: true,
      sampleBytes: audio.byteLength,
    })
  } catch (error) {
    if (error instanceof CouncilVoiceNotConfiguredError) {
      return NextResponse.json({
        voiceConfigured: false,
        ok: false,
        error: error.message,
      })
    }

    return NextResponse.json(
      {
        voiceConfigured: isCouncilVoiceOutputConfigured(),
        ok: false,
        error: error instanceof Error ? error.message : "Voice check failed",
      },
      { status: 500 },
    )
  }
}
