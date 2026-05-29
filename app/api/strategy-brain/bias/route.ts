import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getMarketBias,
  StrategyBrainTableMissingError,
  upsertMarketBias,
} from "@/lib/strategy-brain/server-service"
import type { MarketBiasInput } from "@/lib/strategy-brain/types"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const bias = await getMarketBias(supabase, user.id)
    return NextResponse.json({ bias })
  } catch (error) {
    if (error instanceof StrategyBrainTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch bias" },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as Partial<MarketBiasInput>
    const input: MarketBiasInput = {
      weekly_bias: body.weekly_bias ?? "Neutral",
      daily_bias: body.daily_bias ?? "Neutral",
      h4_bias: body.h4_bias ?? "Neutral",
    }

    const bias = await upsertMarketBias(supabase, user.id, input)
    return NextResponse.json({ bias })
  } catch (error) {
    if (error instanceof StrategyBrainTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save bias" },
      { status: 500 },
    )
  }
}
