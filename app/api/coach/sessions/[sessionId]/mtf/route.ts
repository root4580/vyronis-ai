import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  removeCoachMtfScreenshot,
  runCoachMtfAnalysis,
  submitCoachMtfScreenshot,
  syncWarRoomChartsToCoachSession,
  TradeCoachTableMissingError,
} from "@/lib/trade-coach/server-service"
import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import { MTF_TIMEFRAME_IDS } from "@/lib/coach/mtf-constants"

type RouteContext = {
  params: Promise<{ sessionId: string }>
}

function isValidTimeframe(value: string): value is CoachMtfTimeframe {
  return MTF_TIMEFRAME_IDS.includes(value as CoachMtfTimeframe)
}

export const maxDuration = 120

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

    const body = (await request.json()) as {
      action?: "analyze" | "syncWarRoom"
      timeframe?: string
      chartUrl?: string
    }

    if (body.action === "analyze") {
      const session = await runCoachMtfAnalysis(supabase, user.id, sessionId)
      return NextResponse.json(session)
    }

    if (body.action === "syncWarRoom") {
      const session = await syncWarRoomChartsToCoachSession(supabase, user.id, sessionId)
      return NextResponse.json(session)
    }

    if (!body.timeframe || !isValidTimeframe(body.timeframe)) {
      return NextResponse.json({ error: "Valid timeframe is required" }, { status: 400 })
    }
    if (!body.chartUrl?.trim()) {
      return NextResponse.json({ error: "chartUrl is required" }, { status: 400 })
    }

    const session = await submitCoachMtfScreenshot(
      supabase,
      user.id,
      sessionId,
      body.timeframe,
      body.chartUrl.trim(),
    )

    return NextResponse.json(session)
  } catch (error) {
    if (error instanceof TradeCoachTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Coach MTF error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save MTF chart" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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

    const { timeframe } = (await request.json()) as { timeframe?: string }
    if (!timeframe || !isValidTimeframe(timeframe)) {
      return NextResponse.json({ error: "Valid timeframe is required" }, { status: 400 })
    }

    const session = await removeCoachMtfScreenshot(supabase, user.id, sessionId, timeframe)
    return NextResponse.json(session)
  } catch (error) {
    if (error instanceof TradeCoachTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Coach MTF remove error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove MTF chart" },
      { status: 500 },
    )
  }
}
