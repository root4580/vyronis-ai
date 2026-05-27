import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  removeCoachChart,
  submitCoachChart,
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

    const body = (await request.json()) as { chartUrl?: string; replace?: boolean }
    if (!body.chartUrl?.trim()) {
      return NextResponse.json({ error: "chartUrl is required" }, { status: 400 })
    }

    const session = await submitCoachChart(
      supabase,
      user.id,
      sessionId,
      body.chartUrl.trim(),
      { replace: body.replace === true },
    )

    return NextResponse.json(session)
  } catch (error) {
    if (error instanceof TradeCoachTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Coach chart upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save chart" },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
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

    const session = await removeCoachChart(supabase, user.id, sessionId)
    return NextResponse.json(session)
  } catch (error) {
    if (error instanceof TradeCoachTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Coach chart remove error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove chart" },
      { status: 500 },
    )
  }
}
