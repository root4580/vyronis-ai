import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveActiveAccountId } from "@/lib/accounts/server-active-account"
import { getTradingRulesSnapshot } from "@/lib/trading-rules/trading-rules-service"

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
      return NextResponse.json({ snapshot: null })
    }

    const snapshot = await getTradingRulesSnapshot(supabase, user.id, accountId)
    return NextResponse.json({ snapshot })
  } catch (error) {
    console.error("Trading rules GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load trading rules" },
      { status: 500 },
    )
  }
}
