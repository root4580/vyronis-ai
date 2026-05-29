import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  archiveTradingViewSignal,
  markTradingViewSignalRead,
  TradingViewSignalsTableMissingError,
} from "@/lib/tradingview/signal-server-service"

type RouteContext = { params: Promise<{ signalId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { signalId } = await context.params
    const body = await request.json()

    if (body.read) {
      await markTradingViewSignalRead(supabase, user.id, signalId)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  } catch (error) {
    if (error instanceof TradingViewSignalsTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Patch TradingView signal error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { signalId } = await context.params
    await archiveTradingViewSignal(supabase, user.id, signalId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof TradingViewSignalsTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Delete TradingView signal error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 },
    )
  }
}
