import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getCoachSession,
  getPendingCoachSession,
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

    const pending = await getPendingCoachSession(supabase, user.id)
    if (!pending) {
      return NextResponse.json({ error: "No pending coach session" }, { status: 404 })
    }

    const session = await getCoachSession(supabase, user.id, pending.id)
    if (!session) {
      return NextResponse.json({ error: "No pending coach session" }, { status: 404 })
    }

    return NextResponse.json(session)
  } catch (error) {
    if (error instanceof TradeCoachTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Pending coach session error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch pending session" },
      { status: 500 },
    )
  }
}
