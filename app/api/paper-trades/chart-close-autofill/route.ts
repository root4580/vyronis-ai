import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildPaperChartCloseAutofill } from "@/lib/paper-trades/chart-close-autofill"

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
      symbol?: string
      direction?: string
      entry?: number | null
      sl?: number | null
      tp?: number | null
    }

    const imageUrl = body.imageUrl?.trim()
    if (!imageUrl || !imageUrl.startsWith("http")) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 })
    }

    const result = await buildPaperChartCloseAutofill({
      imageUrl,
      symbol: body.symbol?.trim() || "UNKNOWN",
      direction: body.direction?.trim() || "BUY",
      entry: body.entry ?? null,
      sl: body.sl ?? null,
      tp: body.tp ?? null,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Paper chart close autofill error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Close chart autofill failed" },
      { status: 500 },
    )
  }
}
