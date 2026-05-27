import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  recordQualityOverride,
  TradeCoachTableMissingError,
} from "@/lib/trade-coach/server-service"

type RouteContext = {
  params: Promise<{ sessionId: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const session = await recordQualityOverride(supabase, user.id, sessionId)
    return NextResponse.json(session)
  } catch (error) {
    if (error instanceof TradeCoachTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Quality override error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record override" },
      { status: 500 },
    )
  }
}
