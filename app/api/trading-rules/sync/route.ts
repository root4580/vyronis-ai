import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncTradingRulesCooldown } from "@/lib/trading-rules/trading-rules-service"

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

    const body = (await request.json().catch(() => ({}))) as { accountId?: string }
    const accountId = body.accountId?.trim()
    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 })
    }

    const snapshot = await syncTradingRulesCooldown(supabase, user.id, accountId)
    return NextResponse.json({ snapshot })
  } catch (error) {
    console.error("Trading rules sync error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not sync trading rules" },
      { status: 500 },
    )
  }
}
