import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getStrategyBrainDashboard,
  StrategyBrainTableMissingError,
} from "@/lib/strategy-brain/server-service"

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

    const dashboard = await getStrategyBrainDashboard(supabase, user.id)
    return NextResponse.json(dashboard)
  } catch (error) {
    if (error instanceof StrategyBrainTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Strategy brain dashboard error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load dashboard" },
      { status: 500 },
    )
  }
}
