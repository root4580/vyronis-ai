import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  closePaperTrade,
  PaperTradesTableMissingError,
} from "@/lib/paper-trades/paper-trade-service"
import type { ClosePaperTradeInput } from "@/lib/paper-trades/types"

type RouteContext = { params: Promise<{ paperTradeId: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { paperTradeId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as ClosePaperTradeInput
    if (!Number.isFinite(body.close_price)) {
      return NextResponse.json({ error: "Close price is required" }, { status: 400 })
    }
    if (!body.result) {
      return NextResponse.json({ error: "Result must be WIN, LOSS, or BREAKEVEN" }, { status: 400 })
    }

    const trade = await closePaperTrade(supabase, user.id, paperTradeId, body)
    return NextResponse.json({ trade })
  } catch (error) {
    if (error instanceof PaperTradesTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Paper trade PATCH error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not close paper trade" },
      { status: 400 },
    )
  }
}
