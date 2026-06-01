import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveActiveAccountId } from "@/lib/accounts/server-active-account"
import type { CouncilAgentId } from "@/lib/council/types"
import {
  CouncilTablesMissingError,
  runCouncilMorningBriefing,
} from "@/lib/council/server-service"

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

    const body = (await request.json().catch(() => ({}))) as {
      accountId?: string | null
      force?: boolean
    }

    const accountId =
      body.accountId?.trim() || (await resolveActiveAccountId(supabase, user.id, request))
    if (!accountId) {
      return NextResponse.json({ error: "No active account" }, { status: 400 })
    }

    const result = await runCouncilMorningBriefing(supabase, user.id, accountId, {
      force: body.force,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CouncilTablesMissingError) {
      return NextResponse.json(
        { error: error.message, migrationPending: true },
        { status: 503 },
      )
    }
    console.error("Council briefing POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not run briefing" },
      { status: 500 },
    )
  }
}
