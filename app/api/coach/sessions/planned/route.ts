import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  resolveActiveAccountId,
  resolveLegacyTradeAccountId,
} from "@/lib/accounts/server-active-account"
import {
  listPlannedCoachSessions,
  TradeCoachTableMissingError,
} from "@/lib/trade-coach/server-service"

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
    const legacyAccountId = await resolveLegacyTradeAccountId(supabase, user.id)
    const planned = await listPlannedCoachSessions(
      supabase,
      user.id,
      20,
      accountId,
      legacyAccountId,
    )
    return NextResponse.json(planned)
  } catch (error) {
    if (error instanceof TradeCoachTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Planned coach sessions error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch planned sessions" },
      { status: 500 },
    )
  }
}
