import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  countUnreadTradingViewSignals,
  listTradingViewSignals,
  markAllTradingViewSignalsRead,
  TradingViewSignalsTableMissingError,
} from "@/lib/tradingview/signal-server-service"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const unreadOnly = request.nextUrl.searchParams.get("unreadOnly") === "true"
    const limit = Number(request.nextUrl.searchParams.get("limit") || "20")

    const [signals, unreadCount] = await Promise.all([
      listTradingViewSignals(supabase, user.id, { unreadOnly, limit }),
      countUnreadTradingViewSignals(supabase, user.id),
    ])

    return NextResponse.json({ signals, unreadCount })
  } catch (error) {
    if (error instanceof TradingViewSignalsTableMissingError) {
      return NextResponse.json({ signals: [], unreadCount: 0 })
    }
    console.error("List TradingView signals error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load signals" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    if (body.readAll) {
      await markAllTradingViewSignalsRead(supabase, user.id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  } catch (error) {
    console.error("Patch TradingView signals error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 },
    )
  }
}
