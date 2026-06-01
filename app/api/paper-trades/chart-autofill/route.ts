import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildPaperChartAutofill } from "@/lib/paper-trades/chart-autofill"
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
      symbolHint?: string
      directionHint?: TradePlanDirection
    }

    const imageUrl = body.imageUrl?.trim()
    if (!imageUrl || !imageUrl.startsWith("http")) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 })
    }

    const result = await buildPaperChartAutofill({
      imageUrl,
      symbolHint: body.symbolHint?.trim(),
      directionHint: body.directionHint,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Paper chart autofill error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chart autofill failed" },
      { status: 500 },
    )
  }
}
