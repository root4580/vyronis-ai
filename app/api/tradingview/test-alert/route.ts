import { after, NextResponse } from "next/server"
import { getAppBaseUrl } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import {
  ensureTradingViewWebhookSettings,
  TradingViewSignalsTableMissingError,
} from "@/lib/tradingview/signal-server-service"
import { getWeeklyPlanWithPairs } from "@/lib/strategy-brain/server-service"
import { getWeekStartSunday } from "@/lib/strategy-brain/week-utils"
import { runTradingViewChartVisionEnrichment } from "@/lib/tradingview/schedule-chart-vision"
import { ingestTradingViewAlert } from "@/lib/tradingview/webhook-server-service"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const settings = await ensureTradingViewWebhookSettings(
      supabase,
      user.id,
      getAppBaseUrl(request),
    )

    let symbol =
      typeof body.symbol === "string" && body.symbol.trim()
        ? body.symbol.trim().toUpperCase()
        : null
    let direction: "BUY" | "SELL" =
      body.direction === "SELL" ? "SELL" : body.direction === "BUY" ? "BUY" : "BUY"

    if (!symbol) {
      const weekPlan = await getWeeklyPlanWithPairs(
        supabase,
        user.id,
        getWeekStartSunday(),
      ).catch(() => null)
      const pairs = weekPlan?.pairs ?? []
      const aoiRank = (status: string) => {
        if (status === "CONFIRMING") return 4
        if (status === "INSIDE_AOI") return 3
        if (status === "WAITING") return 1
        return 0
      }
      const best = [...pairs].sort((a, b) => aoiRank(b.aoi_status) - aoiRank(a.aoi_status))[0]
      symbol = best?.pair ?? "GBPCAD"
      if (best?.directional_bias === "Bearish") direction = "SELL"
      else if (best?.directional_bias === "Bullish") direction = "BUY"
    }

    // Use the logged-in user's Supabase session (same project as the UI).
    // Service role is optional (chart vision / email only).
    const { result, chartVision } = await ingestTradingViewAlert(
      supabase,
      {
        secret: settings.secret,
        symbol,
        direction,
        timeframe: "60",
        strategy_name: "Vyronis test alert",
        entry_zone: "Test zone",
        stop_loss: null,
        take_profit: null,
        confidence: 70,
        message: "Simulated alert from Account Settings — check the bell icon.",
        chart_url: null,
        alert_id: `test-${Date.now()}`,
      },
      { source: "vyronis_test_alert", user_id: user.id },
      { trustedUserId: user.id, skipSecretValidation: true },
    )

    if (chartVision) {
      after(() => {
        try {
          const admin = createServiceRoleClient()
          runTradingViewChartVisionEnrichment(admin, chartVision)
        } catch {
          runTradingViewChartVisionEnrichment(supabase, chartVision)
        }
      })
    }

    return NextResponse.json({
      ...result,
      symbol,
      direction,
    })
  } catch (error) {
    if (error instanceof TradingViewSignalsTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("TradingView test alert error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not send test alert",
      },
      { status: 500 },
    )
  }
}
