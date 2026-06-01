import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { computePaperTradeStats } from "@/lib/paper-trades/stats"
import {
  createPaperTrade,
  listPaperTrades,
  PaperTradesTableMissingError,
  resolvePaperTradeContext,
} from "@/lib/paper-trades/paper-trade-service"
import type { PaperTradeInput } from "@/lib/paper-trades/types"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { accountId, legacyAccountId } = await resolvePaperTradeContext(supabase, user.id, request)
    const trades = await listPaperTrades(supabase, user.id, accountId, legacyAccountId)
    const stats = computePaperTradeStats(trades)

    return NextResponse.json({ trades, stats })
  } catch (error) {
    if (error instanceof PaperTradesTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Paper trades GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load paper trades" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as PaperTradeInput
    if (!body.symbol?.trim()) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 })
    }
    if (!body.direction?.trim()) {
      return NextResponse.json({ error: "Direction is required" }, { status: 400 })
    }

    const { accountId } = await resolvePaperTradeContext(supabase, user.id, request)
    const trade = await createPaperTrade(supabase, user.id, accountId, body)
    return NextResponse.json({ trade })
  } catch (error) {
    if (error instanceof PaperTradesTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Paper trades POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create paper trade" },
      { status: 500 },
    )
  }
}
