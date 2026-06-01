import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { COUNCIL_AGENT_IDS, normalizeCouncilAgentId } from "@/lib/council/agent-ids"
import type { CouncilAgentId } from "@/lib/council/types"
import {
  councilSettingsToVoiceMap,
  CouncilVoiceNotConfiguredError,
  synthesizeCouncilSpeech,
} from "@/lib/council/elevenlabs-service"
import { getOrCreateCouncilSettings } from "@/lib/council/server-service"

export const dynamic = "force-dynamic"

const AGENTS = new Set<CouncilAgentId>(COUNCIL_AGENT_IDS)

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

    const body = (await request.json()) as {
      agent?: string
      text?: string
    }

    const agentId = normalizeCouncilAgentId(body.agent ?? "")
    if (!agentId || !AGENTS.has(agentId)) {
      return NextResponse.json({ error: "Valid agent is required" }, { status: 400 })
    }

    const text = body.text?.trim()
    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    const settings = await getOrCreateCouncilSettings(supabase, user.id)
    const audio = await synthesizeCouncilSpeech({
      agentId,
      text,
      settings: councilSettingsToVoiceMap(settings),
    })

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    if (error instanceof CouncilVoiceNotConfiguredError) {
      return NextResponse.json({ error: error.message, voiceConfigured: false }, { status: 503 })
    }
    console.error("Council speak POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not synthesize speech" },
      { status: 500 },
    )
  }
}
