import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { resolveActiveAccountId } from "@/lib/accounts/server-active-account"
import { COUNCIL_AGENT_IDS, normalizeCouncilAgentId } from "@/lib/council/agent-ids"
import type { CouncilAgentId } from "@/lib/council/types"
import { councilAcceptsInputSource, type CouncilInputSource } from "@/lib/council/voice-only-input"
import { CouncilTablesMissingError, runCouncilRespond } from "@/lib/council/server-service"

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

    const rateLimit = await checkRateLimit(
      createServiceRoleClient(),
      `council-respond:${user.id}`,
      { maxRequests: 20, windowSeconds: 60 },
    )
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit)
    }

    const body = (await request.json()) as {
      message?: string
      accountId?: string | null
      agent?: string
      conversationAgent?: string
      fullCouncilParticipation?: boolean
      inputSource?: CouncilInputSource
    }

    const inputSource: CouncilInputSource =
      body.inputSource === "voice" ? "voice" : "text"
    if (!councilAcceptsInputSource(true, inputSource)) {
      return NextResponse.json(
        {
          error:
            "Council only responds to your voice. Tap the mic and speak — typed messages are not sent to agents.",
        },
        { status: 400 },
      )
    }

    const accountId =
      body.accountId?.trim() || (await resolveActiveAccountId(supabase, user.id, request))
    if (!accountId) {
      return NextResponse.json({ error: "No active account" }, { status: 400 })
    }

    const preferredAgentRaw =
      body.agent && AGENTS.has(body.agent as CouncilAgentId)
        ? (body.agent as CouncilAgentId)
        : normalizeCouncilAgentId(body.agent ?? "")
    const preferredAgent =
      preferredAgentRaw && AGENTS.has(preferredAgentRaw) ? preferredAgentRaw : undefined
    const conversationAgentRaw =
      body.conversationAgent && AGENTS.has(body.conversationAgent as CouncilAgentId)
        ? (body.conversationAgent as CouncilAgentId)
        : normalizeCouncilAgentId(body.conversationAgent ?? "")
    const conversationAgent =
      conversationAgentRaw && AGENTS.has(conversationAgentRaw) ? conversationAgentRaw : undefined

    const result = await runCouncilRespond(
      supabase,
      user.id,
      accountId,
      body.message ?? "",
      {
        preferredAgent,
        conversationAgent,
        fullCouncilParticipation: body.fullCouncilParticipation,
      },
    )
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CouncilTablesMissingError) {
      return NextResponse.json(
        { error: error.message, migrationPending: true },
        { status: 503 },
      )
    }
    console.error("Council respond POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not reach the council" },
      { status: 500 },
    )
  }
}
