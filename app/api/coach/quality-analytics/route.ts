import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTradeQualityAnalytics } from "@/lib/trade-coach/server-service"

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

    const analytics = await getTradeQualityAnalytics(supabase, user.id)
    return NextResponse.json(analytics)
  } catch (error) {
    console.error("Trade quality analytics error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch quality analytics" },
      { status: 500 },
    )
  }
}
