import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildFullTraderContext } from "@/lib/intelligence/trader-context-builder"
import { runReplayScenario } from "@/lib/trading-os/replay-simulator"
import type { ReplayScenarioId } from "@/lib/trading-os/types"
import type { ReflectionTradeInput } from "@/lib/autonomous/reflection-engine"

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

    const { searchParams } = new URL(request.url)
    const focusId = searchParams.get("focusId")

    const context = await buildFullTraderContext(supabase, user.id, { focusId })

    return NextResponse.json({
      tradingOs: context.tradingOs,
      computedAt: context.tradingOs?.computedAt ?? null,
    })
  } catch (error) {
    console.error("Trading OS error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load trading OS" },
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

    const body = (await request.json().catch(() => ({}))) as {
      scenarioId?: ReplayScenarioId
      trade?: ReflectionTradeInput
    }

    if (body.scenarioId && body.trade) {
      const scenario = runReplayScenario({
        trade: body.trade,
        scenarioId: body.scenarioId,
      })
      return NextResponse.json({ scenario })
    }

    const context = await buildFullTraderContext(supabase, user.id, {})
    return NextResponse.json({ tradingOs: context.tradingOs })
  } catch (error) {
    console.error("Trading OS POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    )
  }
}
