import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createPreTradeSession,
  TradeCoachTableMissingError,
} from "@/lib/trade-coach/server-service"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      plannedContext?: PreTradePlannedContext
      maxRiskPerTrade?: number
    }

    const plannedContext: PreTradePlannedContext = {
      ...(body.plannedContext || {}),
      max_risk_per_trade: body.maxRiskPerTrade ?? body.plannedContext?.max_risk_per_trade,
    }

    const session = await createPreTradeSession(supabase, user.id, plannedContext)

    return NextResponse.json(session)
  } catch (error) {
    if (error instanceof TradeCoachTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Coach session create error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create coach session" },
      { status: 500 },
    )
  }
}
