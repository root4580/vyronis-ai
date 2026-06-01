import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  CouncilVoiceNotConfiguredError,
  synthesizeCouncilSpeech,
  councilSettingsToVoiceMap,
} from "@/lib/council/elevenlabs-service"
import { getOrCreateCouncilSettings } from "@/lib/council/server-service"
import {
  findCouncilVoiceCollisions,
  isCouncilVoiceOutputConfigured,
  resolveCouncilVoiceId,
} from "@/lib/council/voices"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

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

    const settings = await getOrCreateCouncilSettings(supabase, user.id)
    const voiceMap = councilSettingsToVoiceMap(settings)
    const collisions = findCouncilVoiceCollisions(voiceMap)
    const lunaVoiceId = resolveCouncilVoiceId("luna", voiceMap)
    const zaraVoiceId = resolveCouncilVoiceId("zara", voiceMap)

    const audio = await synthesizeCouncilSpeech({
      agentId: "jarvis",
      text: "Council voice check.",
      settings: voiceMap,
    })

    return NextResponse.json({
      voiceConfigured: true,
      ok: true,
      sampleBytes: audio.byteLength,
      voices: {
        luna: lunaVoiceId,
        zara: zaraVoiceId,
        distinct: lunaVoiceId !== zaraVoiceId,
      },
      collisions: collisions.map((entry) => ({
        agents: entry.agents,
        voiceId: entry.voiceId,
      })),
      warning:
        lunaVoiceId === zaraVoiceId
          ? "Lex and Kai share the same ElevenLabs voice ID — set different ELEVENLABS_ZARA_VOICE_ID (Lex) and ELEVENLABS_LUNA_VOICE_ID (Kai) in Vercel."
          : collisions.length > 0
            ? `Duplicate voice IDs: ${collisions.map((c) => c.agents.join(" + ")).join("; ")}`
            : null,
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
