import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getLinkedCoachSessionByTradeId,
  TradeCoachTableMissingError,
} from "@/lib/trade-coach/server-service"

export async function GET(request: NextRequest) {
  try {
    const tradeId = request.nextUrl.searchParams.get("tradeId")
    if (!tradeId) {
      return NextResponse.json({ error: "tradeId is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const session = await getLinkedCoachSessionByTradeId(supabase, user.id, tradeId)
    if (!session) {
      return NextResponse.json({ error: "Linked session not found" }, { status: 404 })
    }

    return NextResponse.json(session)
  } catch (error) {
    if (error instanceof TradeCoachTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Linked coach session error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch linked session" },
      { status: 500 },
    )
  }
}
