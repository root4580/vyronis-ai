import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { analyzeMt5TradeScreenshot } from "@/lib/journal/mt5-screenshot-vision-engine"

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
    }

    const imageUrl = body.imageUrl?.trim()
    if (!imageUrl || !imageUrl.startsWith("http")) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 })
    }

    const autofill = await analyzeMt5TradeScreenshot({
      imageUrl,
      pairHint: body.pairHint?.trim(),
    })

    return NextResponse.json({ autofill })
  } catch (error) {
    console.error("MT5 screenshot autofill error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "MT5 autofill failed" },
      { status: 500 },
    )
  }
}
