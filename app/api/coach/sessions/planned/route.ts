import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  listPlannedCoachSessions,
  TradeCoachTableMissingError,
} from "@/lib/trade-coach/server-service"

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

    const planned = await listPlannedCoachSessions(supabase, user.id)
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
