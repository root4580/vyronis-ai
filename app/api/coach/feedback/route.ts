import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  generateAndSaveCoachFeedback,
  getCoachFeedbackForTrade,
  TradeCoachTableMissingError,
} from "@/lib/trade-coach/server-service"
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

    const tradeId = request.nextUrl.searchParams.get("tradeId")
    if (!tradeId) {
      return NextResponse.json({ error: "tradeId is required" }, { status: 400 })
    }

    const feedback = await getCoachFeedbackForTrade(supabase, user.id, tradeId)
    if (!feedback) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 })
    }

    return NextResponse.json(feedback)
  } catch (error) {
    if (error instanceof TradeCoachTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Coach feedback fetch error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch coach feedback" },
      { status: 500 },
    )
  }
}

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

    const body = (await request.json()) as { tradeId?: string }
    if (!body.tradeId) {
      return NextResponse.json({ error: "tradeId is required" }, { status: 400 })
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("max_risk_per_trade")
      .eq("user_id", user.id)
      .maybeSingle()

    const maxRiskPerTrade =
      settings?.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade

    const feedback = await generateAndSaveCoachFeedback(
      supabase,
      user.id,
      body.tradeId,
      maxRiskPerTrade,
    )

    return NextResponse.json(feedback)
  } catch (error) {
    if (error instanceof TradeCoachTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Coach feedback generate error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate coach feedback" },
      { status: 500 },
    )
  }
}
