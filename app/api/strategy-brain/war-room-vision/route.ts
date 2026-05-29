import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { analyzeWarRoomCharts } from "@/lib/strategy-brain/war-room-vision-engine"
import { StrategyBrainTableMissingError } from "@/lib/strategy-brain/server-service"

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
      imageUrls?: string[]
      pairHint?: string
    }

    const imageUrls = Array.isArray(body.imageUrls)
      ? body.imageUrls.filter((u) => typeof u === "string" && u.startsWith("http"))
      : []

    const autofill = await analyzeWarRoomCharts({
      imageUrls,
      pairHint: body.pairHint?.trim(),
    })

    return NextResponse.json({ autofill })
  } catch (error) {
    if (error instanceof StrategyBrainTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "War Room vision failed" },
      { status: 500 },
    )
  }
}
