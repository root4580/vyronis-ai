import { NextResponse } from "next/server"
import {
  evaluateLossStreakEmailAlert,
  evaluateMorningChapterEmailAlert,
} from "@/lib/alerts/evaluate-alerts"
import { resolveActiveAccountId } from "@/lib/accounts/server-active-account"
import { mapTradeToRiskHistory } from "@/lib/dashboard-risk-awareness"
import { journalTradesOrFilter } from "@/lib/analytics/trade-scope"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accountId = await resolveActiveAccountId(supabase, user.id)

    const morningResult = await evaluateMorningChapterEmailAlert({
      supabase,
      userId: user.id,
      email: user.email,
      accountId,
    })

    const { data: trades, error: tradesError } = await supabase
      .from("trades")
      .select("id, result, pnl, trade_date, created_at, risk_percent, rule_followed, emotion, stop_loss")
      .eq("user_id", user.id)
      .or(journalTradesOrFilter())
      .order("created_at", { ascending: false })
      .limit(200)

    if (tradesError) {
      return NextResponse.json({ error: tradesError.message }, { status: 500 })
    }

    const history = (trades ?? []).map(mapTradeToRiskHistory)
    const result = await evaluateLossStreakEmailAlert({
      supabase,
      userId: user.id,
      email: user.email,
      trades: history,
    })

    return NextResponse.json({
      ok: true,
      lossStreak: result.streak,
      emailSent: result.sent,
      morningBriefingSent: morningResult.sent,
    })
  } catch (error) {
    console.error("alerts/check failed:", error)
    return NextResponse.json({ error: "Alert check failed" }, { status: 500 })
  }
}
