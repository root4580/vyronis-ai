import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildTradePlanChartAutofill } from "@/lib/trade-planner/chart-autofill"
import { analyzeTradePlanChartScreenshot } from "@/lib/trade-planner/plan-chart-vision-engine"
import type { TradePlanDirection } from "@/lib/trade-planner/types"

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
      imageUrl?: string
      pairHint?: string
      directionHint?: TradePlanDirection
      accountSize?: number
      riskPercent?: number
    }

    const imageUrl = body.imageUrl?.trim()
    if (!imageUrl || !imageUrl.startsWith("http")) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 })
    }

    const vision = await analyzeTradePlanChartScreenshot({
      imageUrl,
      pairHint: body.pairHint?.trim(),
      directionHint: body.directionHint,
    })

    const result = buildTradePlanChartAutofill({
      vision,
      pairHint: body.pairHint?.trim(),
      directionHint: body.directionHint,
      accountSize: Number(body.accountSize) || 0,
      riskPercent: Number(body.riskPercent) || 0.5,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Trade plan chart autofill error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chart autofill failed" },
      { status: 500 },
    )
  }
}
