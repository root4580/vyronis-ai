import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveActiveAccountId } from "@/lib/accounts/server-active-account"
import { loadCachedCouncilVisualContext } from "@/lib/council/context-cache"
import { CouncilTablesMissingError } from "@/lib/council/server-service"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accountId = await resolveActiveAccountId(supabase, user.id, request)
    if (!accountId) {
      return NextResponse.json({ error: "No active account" }, { status: 400 })
    }

    const visual = await loadCachedCouncilVisualContext(supabase, user.id, accountId)
    return NextResponse.json({ visual })
  } catch (error) {
    if (error instanceof CouncilTablesMissingError) {
      return NextResponse.json(
        { error: error.message, migrationPending: true, visual: null },
        { status: 503 },
      )
    }
    console.error("Council context GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load council context" },
      { status: 500 },
    )
  }
}
