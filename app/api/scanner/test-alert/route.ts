import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isScannerAlertEmailConfigured, sendScannerAlertEmail } from "@/lib/email/scanner-alert-email"

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

    if (!isScannerAlertEmailConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Email alerts not configured. Add RESEND_API_KEY to Vercel env.",
        },
        { status: 503 },
      )
    }

    const result = await sendScannerAlertEmail({
      to: user.email,
      pair: "EUR/USD",
      direction: "SELL",
      grade: "A+ Sniper",
      score: 96,
      session: "London",
      zoneType: "FVG",
      riskReward: 2.1,
      weeklyBias: "Bearish",
      dailyBias: "Bearish",
      h4Bias: "Bearish",
      entry: 1.1462,
      stopLoss: 1.1484,
      takeProfit: 1.1416,
      confirmationType: "Bearish engulfing (M15) — test alert",
    })

    if (!result.sent) {
      return NextResponse.json(
        { ok: false, error: result.skippedReason ?? "Could not send email." },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      message: `Test alert sent to ${user.email}. Check your phone if mail notifications are on.`,
    })
  } catch (error) {
    console.error("[Scanner test alert]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test alert failed" },
      { status: 500 },
    )
  }
}
