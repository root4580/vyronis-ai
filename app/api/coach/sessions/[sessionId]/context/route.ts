import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  TradeCoachTableMissingError,
  updateCoachSessionPlannedContext,
} from "@/lib/trade-coach/server-service"

type RouteContext = {
  params: Promise<{ sessionId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const body = (await request.json()) as {
      strategy_playbook_id?: string | null
      strategy_name?: string | null
    }

    const session = await updateCoachSessionPlannedContext(supabase, user.id, sessionId, {
      strategy_playbook_id: body.strategy_playbook_id,
      strategy_name: body.strategy_name,
    })

    return NextResponse.json(session)
  } catch (error) {
    if (error instanceof TradeCoachTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Coach session context update error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update coach session context" },
      { status: 500 },
    )
  }
}
