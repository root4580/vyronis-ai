import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { submitCooldownUnlock } from "@/lib/trading-rules/trading-rules-service"

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
      accountId?: string
      lossCause?: string
      changePlan?: string
      emotionalScore?: number | string
    }

    const accountId = body.accountId?.trim()
    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 })
    }

    const result = await submitCooldownUnlock(supabase, user.id, accountId, body)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Cooldown unlock error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not complete cooldown coach" },
      { status: 400 },
    )
  }
}
