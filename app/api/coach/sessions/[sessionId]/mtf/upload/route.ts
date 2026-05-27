import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildMtfStoragePath, MTF_TIMEFRAME_IDS, type CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import { TRADE_SCREENSHOTS_BUCKET } from "@/lib/storage-config"
import { TradeCoachTableMissingError } from "@/lib/trade-coach/server-service"
import { submitCoachMtfScreenshot } from "@/lib/trade-coach/server-service"

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
const MAX_SIZE = 10 * 1024 * 1024

type RouteContext = {
  params: Promise<{ sessionId: string }>
}

function isValidTimeframe(value: string): value is CoachMtfTimeframe {
  return MTF_TIMEFRAME_IDS.includes(value as CoachMtfTimeframe)
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const timeframeRaw = formData.get("timeframe") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    if (!timeframeRaw || !isValidTimeframe(timeframeRaw)) {
      return NextResponse.json({ error: "Valid timeframe is required" }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 10MB" }, { status: 400 })
    }

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
    const fileName = buildMtfStoragePath(user.id, sessionId, timeframeRaw, ext)
    const buffer = new Uint8Array(await file.arrayBuffer())

    const { data, error: uploadError } = await supabase.storage
      .from(TRADE_SCREENSHOTS_BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || "Upload failed" }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from(TRADE_SCREENSHOTS_BUCKET).getPublicUrl(data.path)

    const session = await submitCoachMtfScreenshot(
      supabase,
      user.id,
      sessionId,
      timeframeRaw,
      urlData.publicUrl,
    )

    return NextResponse.json({
      url: urlData.publicUrl,
      path: data.path,
      session,
    })
  } catch (error) {
    if (error instanceof TradeCoachTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Coach MTF upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload MTF chart" },
      { status: 500 },
    )
  }
}
