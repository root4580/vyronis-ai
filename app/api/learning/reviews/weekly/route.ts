import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { persistWeeklyReview } from "@/lib/learning/server-service"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { weekOffset?: number }
    const weekOffset = Number(body.weekOffset ?? 0)

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("max_risk_per_trade")
      .eq("user_id", user.id)
      .maybeSingle()

    const result = await persistWeeklyReview(
      supabase,
      user.id,
      Number.isFinite(weekOffset) ? weekOffset : 0,
      settings?.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade,
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("Weekly learning review error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate weekly review" },
      { status: 500 },
    )
  }
}
