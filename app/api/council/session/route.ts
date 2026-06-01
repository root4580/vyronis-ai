import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveActiveAccountId } from "@/lib/accounts/server-active-account"
import {
  CouncilTablesMissingError,
  clearTodayCouncilSession,
  getCouncilSessionState,
} from "@/lib/council/server-service"

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

    const state = await getCouncilSessionState(supabase, user.id, accountId)
    return NextResponse.json(state)
  } catch (error) {
    if (error instanceof CouncilTablesMissingError) {
      return NextResponse.json(
        { error: error.message, migrationPending: true },
        { status: 503 },
      )
    }
    console.error("Council session GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load council session" },
      { status: 500 },
    )
  }
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

    const body = (await request.json().catch(() => ({}))) as {
      accountId?: string | null
      action?: string
    }
    if (body.action !== "clear") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 })
    }

    const accountId =
      body.accountId?.trim() || (await resolveActiveAccountId(supabase, user.id, request))
    if (!accountId) {
      return NextResponse.json({ error: "No active account" }, { status: 400 })
    }

    await clearTodayCouncilSession(supabase, user.id, accountId)
    const state = await getCouncilSessionState(supabase, user.id, accountId)
    return NextResponse.json(state)
  } catch (error) {
    if (error instanceof CouncilTablesMissingError) {
      return NextResponse.json(
        { error: error.message, migrationPending: true },
        { status: 503 },
      )
    }
    console.error("Council session POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update council session" },
      { status: 500 },
    )
  }
}
