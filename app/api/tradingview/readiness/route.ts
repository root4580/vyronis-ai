import { NextResponse } from "next/server"
import { getAppBaseUrl } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import {
  ensureTradingViewWebhookSettings,
  TradingViewSignalsTableMissingError,
} from "@/lib/tradingview/signal-server-service"
import { getTradingViewSetupReadiness } from "@/lib/tradingview/setup-readiness"

export async function GET(request: Request) {
  try {
    const baseUrl = getAppBaseUrl(request)
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const settings = await ensureTradingViewWebhookSettings(supabase, user.id, baseUrl)

    const { count: signalCount } = await supabase
      .from("tradingview_signals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)

    const readiness = await getTradingViewSetupReadiness(
      supabase,
      user.id,
      settings.enabled,
      { hasReceivedAlert: (signalCount ?? 0) > 0 },
    )

    return NextResponse.json(readiness)
  } catch (error) {
    if (error instanceof TradingViewSignalsTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("TradingView readiness error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load readiness" },
      { status: 500 },
    )
  }
}
