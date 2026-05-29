import { NextResponse } from "next/server"
import { getAppBaseUrl } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import {
  ensureMt5WebhookSettings,
  regenerateMt5WebhookApiKey,
} from "@/lib/mt5/settings-server-service"
import { Mt5WebhookTableMissingError } from "@/lib/mt5/webhook-server-service"

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

    const settings = await ensureMt5WebhookSettings(supabase, user.id, baseUrl)
    return NextResponse.json(settings)
  } catch (error) {
    if (error instanceof Mt5WebhookTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("MT5 settings error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load MT5 settings" },
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
    if (body.regenerateApiKey !== true) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const baseUrl = getAppBaseUrl(request)
    const settings = await regenerateMt5WebhookApiKey(supabase, user.id, baseUrl)
    return NextResponse.json(settings)
  } catch (error) {
    if (error instanceof Mt5WebhookTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("MT5 settings regenerate error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not regenerate API key" },
      { status: 500 },
    )
  }
}
