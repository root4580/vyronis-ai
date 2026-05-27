import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  fetchWeeklyReviews,
  generateWeeklyReviewForUser,
  previewWeeklyReviewForUser,
} from "@/lib/weekly-review/server-service"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const weekOffset = Number(request.nextUrl.searchParams.get("weekOffset") ?? "0")
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "6")
    const preview = request.nextUrl.searchParams.get("preview") === "true"

    const { data: settings } = await supabase
      .from("user_settings")
      .select("max_risk_per_trade")
      .eq("user_id", user.id)
      .maybeSingle()

    const maxRiskPerTrade =
      settings?.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade

    if (preview) {
      const report = await previewWeeklyReviewForUser(
        supabase,
        user.id,
        Number.isFinite(weekOffset) ? weekOffset : 0,
        maxRiskPerTrade,
      )
      return NextResponse.json(report)
    }

    const reviews = await fetchWeeklyReviews(
      supabase,
      user.id,
      Number.isFinite(limit) ? limit : 6,
    )
    return NextResponse.json(reviews)
  } catch (error) {
    console.error("Weekly reviews GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load weekly reviews" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      weekOffset?: number
      useAiNarrative?: boolean
    }
    const weekOffset = Number(body.weekOffset ?? 0)

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("max_risk_per_trade")
      .eq("user_id", user.id)
      .maybeSingle()

    const maxRiskPerTrade =
      settings?.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade

    const result = await generateWeeklyReviewForUser(
      supabase,
      user.id,
      Number.isFinite(weekOffset) ? weekOffset : 0,
      maxRiskPerTrade,
      { useAiNarrative: Boolean(body.useAiNarrative) },
    )

    const reviews = await fetchWeeklyReviews(supabase, user.id, 1)
    const record = reviews[0] ?? null

    return NextResponse.json({
      report: result.report,
      record,
      persisted: result.persisted,
      skipped: result.skipped,
    })
  } catch (error) {
    console.error("Weekly reviews POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate weekly review" },
      { status: 500 },
    )
  }
}
