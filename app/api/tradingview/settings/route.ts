import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  ensureTradingViewWebhookSettings,
  regenerateTradingViewWebhookSecret,
  TradingViewSignalsTableMissingError,
} from "@/lib/tradingview/signal-server-service"
import { buildTradingViewAlertTemplatePlain } from "@/lib/tradingview/alert-template"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const settings = await ensureTradingViewWebhookSettings(supabase, user.id)
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
    if (body.regenerateSecret !== true) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const settings = await regenerateTradingViewWebhookSecret(supabase, user.id)
    return NextResponse.json({
      ...settings,
      alertTemplate: buildTradingViewAlertTemplatePlain(settings.secret),
    })
  } catch (error) {
    if (error instanceof TradingViewSignalsTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("TradingView settings regenerate error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not regenerate secret" },
      { status: 500 },
    )
  }
}
