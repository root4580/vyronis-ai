import { NextRequest, NextResponse } from "next/server"
import { evaluateWeeklyDebriefEmailAlert } from "@/lib/alerts/evaluate-alerts"
import { mapTradeToRiskHistory } from "@/lib/dashboard-risk-awareness"
import { journalTradesOrFilter } from "@/lib/analytics/trade-scope"
import { createServiceRoleClient } from "@/lib/supabase/admin"

function isAuthorizedCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) return process.env.NODE_ENV !== "production"

  const authHeader = request.headers.get("authorization")?.trim()
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createServiceRoleClient()
    const { data: settingsRows, error: settingsError } = await supabase
      .from("user_settings")
      .select("user_id")
      .limit(500)

    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 500 })
    }

    let sent = 0
    let skipped = 0
    const referenceDate = new Date()

    for (const row of settingsRows ?? []) {
      if (!row.user_id) continue

      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(row.user_id)
      const email = authUser?.user?.email
      if (authError || !email) {
        skipped += 1
        continue
      }

      const { data: trades, error: tradesError } = await supabase
        .from("trades")
        .select("id, result, pnl, trade_date, created_at, risk_percent, rule_followed, emotion, stop_loss")
        .eq("user_id", row.user_id)
        .or(journalTradesOrFilter())
        .order("created_at", { ascending: false })
        .limit(200)

      if (tradesError) {
        skipped += 1
        continue
      }

      const history = (trades ?? []).map(mapTradeToRiskHistory)
      const result = await evaluateWeeklyDebriefEmailAlert({
        supabase,
        userId: row.user_id,
        email,
        trades: history,
        referenceDate,
      })

      if (result.sent) sent += 1
      else skipped += 1
    }

    return NextResponse.json({
      ok: true,
      sent,
      skipped,
      users: settingsRows?.length ?? 0,
    })
  } catch (error) {
    console.error("alerts/cron failed:", error)
    return NextResponse.json({ error: "Cron alert job failed" }, { status: 500 })
  }
}
