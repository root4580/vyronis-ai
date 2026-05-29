import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { getAppBaseUrl } from "@/lib/env"
import { ensureMt5WebhookSettings } from "@/lib/mt5/settings-server-service"
import { recordMt5Ping } from "@/lib/mt5/ping-service"
import {
  Mt5WebhookError,
  Mt5WebhookTableMissingError,
  resolveUserByMt5ApiKey,
} from "@/lib/mt5/webhook-server-service"

type Step = { step: string; ok: boolean; detail?: string; error?: string }

/**
 * Browser "Test connection" — validates API key + internal echo (no MT5 required).
 */
export async function POST() {
  const steps: Step[] = []

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ ok: false, steps: [{ step: "auth", ok: false, error: "Unauthorized" }] }, { status: 401 })
    }

    steps.push({ step: "vyronis_session", ok: true, detail: user.id })

    const settings = await ensureMt5WebhookSettings(supabase, user.id)
    steps.push({
      step: "api_key_loaded",
      ok: true,
      detail: `enabled=${settings.enabled} webhook=${settings.webhookUrl}`,
    })

    const admin = createServiceRoleClient()
    let userCtx
    try {
      userCtx = await resolveUserByMt5ApiKey(admin, settings.apiKey)
      steps.push({ step: "api_key_validation", ok: true, detail: userCtx.user_id })
    } catch (e) {
      const msg = e instanceof Mt5WebhookError ? e.message : "Validation failed"
      steps.push({ step: "api_key_validation", ok: false, error: msg })
      return NextResponse.json({ ok: false, steps, settings }, { status: 400 })
    }

    await recordMt5Ping(
      admin,
      userCtx.user_id,
      {
        ping: true,
        test: true,
        account_login: "vyronis-dashboard-test",
        broker: "dashboard",
        balance: 0,
      },
      "Dashboard connection test OK.",
    )
    steps.push({ step: "record_ping", ok: true, detail: "Last sync updated in Supabase" })

    const base = getAppBaseUrl()
    steps.push({
      step: "mt5_urls",
      ok: true,
      detail: `Set EA URLs to: ${base} (ping: ${settings.pingUrl}, trades: ${settings.webhookUrl})`,
    })

    steps.push({
      step: "webrequest_checklist",
      ok: true,
      detail: `Whitelist in MT5: ${new URL(base).origin}`,
    })

    const refreshed = await ensureMt5WebhookSettings(supabase, user.id)

    return NextResponse.json({
      ok: true,
      steps,
      settings: refreshed,
      hint:
        refreshed.connection === "connected"
          ? "Vyronis is ready. Close a trade in MT5 to test full sync."
          : "Dashboard test passed. If MT5 still fails, check Experts log for WebRequest error 4014.",
    })
  } catch (error) {
    if (error instanceof Mt5WebhookTableMissingError) {
      steps.push({ step: "migration", ok: false, error: error.message })
      return NextResponse.json({ ok: false, steps }, { status: 503 })
    }
    steps.push({
      step: "unexpected",
      ok: false,
      error: error instanceof Error ? error.message : "Test failed",
    })
    return NextResponse.json({ ok: false, steps }, { status: 500 })
  }
}
