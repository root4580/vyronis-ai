import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAppBaseUrl } from "@/lib/env"
import { ensureTradingViewWebhookSettings } from "@/lib/tradingview/signal-server-service"
import { listRecentTradingViewWebhookLogs, countTradingViewWebhookLogs } from "@/lib/tradingview/signals-log-service"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const baseUrl = getAppBaseUrl(request)
    const settings = await ensureTradingViewWebhookSettings(supabase, user.id, baseUrl)
    const logs = await listRecentTradingViewWebhookLogs(supabase, user.id, 10)

    return NextResponse.json({
      webhookUrl: settings.webhookUrl,
      enabled: settings.enabled,
      logs,
    })
  } catch (error) {
    console.error("TradingView webhook activity error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load webhook activity" },
      { status: 500 },
    )
  }
}
