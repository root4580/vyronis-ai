import { NextResponse } from "next/server"
import { getAppBaseUrl } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import {
  ensureTradingViewWebhookSettings,
  regenerateTradingViewWebhookSecret,
  updateTradingViewWebhookEnabled,
  TradingViewSignalsTableMissingError,
} from "@/lib/tradingview/signal-server-service"
import { buildTradingViewAlertTemplatePlain } from "@/lib/tradingview/alert-template"

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
    return NextResponse.json({
      ...settings,
      alertTemplate: buildTradingViewAlertTemplatePlain(settings.secret),
    })
  } catch (error) {
    if (error instanceof TradingViewSignalsTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("TradingView settings error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load settings" },
      { status: 500 },
    )
  }
}

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
    const baseUrl = getAppBaseUrl(request)

    if (body.regenerateSecret === true) {
      const settings = await regenerateTradingViewWebhookSecret(supabase, user.id, baseUrl)
      return NextResponse.json({
        ...settings,
        alertTemplate: buildTradingViewAlertTemplatePlain(settings.secret),
      })
    }

    if (typeof body.enabled === "boolean") {
      const settings = await updateTradingViewWebhookEnabled(supabase, user.id, body.enabled, baseUrl)
      return NextResponse.json({
        ...settings,
        alertTemplate: buildTradingViewAlertTemplatePlain(settings.secret),
      })
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  } catch (error) {
    if (error instanceof TradingViewSignalsTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("TradingView settings POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update settings" },
      { status: 500 },
    )
  }
}
