import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  analyzeTradeIntelligence,
  buildTradeIntelligenceForTrade,
} from "@/lib/intelligence/trade-intelligence-server"

type RouteContext = { params: Promise<{ tradeId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { tradeId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const bundle = await buildTradeIntelligenceForTrade(supabase, user.id, tradeId)
    return NextResponse.json(bundle)
  } catch (error) {
    console.error("Trade intelligence GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build trade intelligence" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { tradeId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: { persistSetupScore?: boolean; syncMemory?: boolean } = {}
    try {
      body = (await request.json()) as typeof body
    } catch {
      body = {}
    }

    const result = await analyzeTradeIntelligence(supabase, user.id, tradeId, body)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Trade intelligence POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze trade intelligence" },
      { status: 500 },
    )
  }
}
