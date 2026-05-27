import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getLearningMemorySnapshot } from "@/lib/learning/server-service"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"

export async function GET() {
  try {
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

    const snapshot = await getLearningMemorySnapshot(supabase, user.id)
    return NextResponse.json({
      ...snapshot,
      maxRiskPerTrade: settings?.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade,
    })
  } catch (error) {
    console.error("Learning dashboard error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load learning dashboard" },
      { status: 500 },
    )
  }
}
