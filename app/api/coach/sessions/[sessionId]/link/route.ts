import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  linkCoachSessionToTrade,
  TradeCoachTableMissingError,
} from "@/lib/trade-coach/server-service"

type RouteContext = {
  params: Promise<{ sessionId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
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

    const body = (await request.json()) as { tradeId?: string }
    if (!body.tradeId) {
      return NextResponse.json({ error: "tradeId is required" }, { status: 400 })
    }

    const session = await linkCoachSessionToTrade(
      supabase,
      user.id,
      sessionId,
      body.tradeId,
    )

    return NextResponse.json(session)
  } catch (error) {
    if (error instanceof TradeCoachTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Coach link error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to link coach session" },
      { status: 500 },
    )
  }
}
