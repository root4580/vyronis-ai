import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveActiveAccountId } from "@/lib/accounts/server-active-account"
import { CouncilTablesMissingError, runCouncilOpenRitual } from "@/lib/council/server-service"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { accountId?: string }
    const accountId =
      body.accountId?.trim() || (await resolveActiveAccountId(supabase, user.id, request))

    if (!accountId) {
      return NextResponse.json({ error: "Active account is required" }, { status: 400 })
    }

    const result = await runCouncilOpenRitual(supabase, user.id, accountId)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CouncilTablesMissingError) {
      return NextResponse.json({ migrationPending: true, messages: [], awaitingEmotionCheck: false })
    }
    console.error("Council open POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Council open failed" },
      { status: 500 },
    )
  }
}
