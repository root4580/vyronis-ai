import { NextRequest, NextResponse } from "next/server"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import { pickIngestClient, resolveMt5TestAuth } from "@/lib/mt5/resolve-test-auth"
import { formatPipelineReport } from "@/lib/mt5/pipeline-log"
import { ingestMt5Trade, Mt5WebhookError } from "@/lib/mt5/webhook-server-service"
import type { Mt5TradeWebhookPayload } from "@/lib/mt5/types"
import { getServiceRoleKey } from "@/lib/env"

function defaultTestPayload(): Mt5TradeWebhookPayload {
  return {
    ticket: `mt5-test-${Date.now()}`,
    symbol: "EURUSD",
    direction: "BUY",
    profit: 47.25,
    volume: 0.1,
    open_time: "2026.05.27 09:15:00",
    close_time: "2026.05.27 15:42:00",
    sl: 1.082,
    tp: 1.092,
    comment: "vyronis-mt5-pipeline-test",
    replace: false,
  }
}

const KEY_STAGES = ["normalize", "supabase_save", "journal_calendar", "intelligence_sync"] as const

function logKeyStages(pipeline: NonNullable<Awaited<ReturnType<typeof ingestMt5Trade>>["pipeline"]>) {
  for (const key of KEY_STAGES) {
    const stage = pipeline.stages.find((s) => s.stage === key)
    if (!stage) continue
    const line = `[MT5 Test] ${key} → ${stage.status}${stage.detail ? ` (${stage.detail})` : ""}${stage.error ? ` ERROR: ${stage.error}` : ""}`
    if (stage.status === "error") console.error(line)
    else console.log(line)
  }
}

/** Dev: verify env + auth modes */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production." }, { status: 404 })
  }

  let secretConfigured = false
  let secretValid = false
  try {
    getServiceRoleKey()
    secretConfigured = true
    const { createServiceRoleClient } = await import("@/lib/supabase/admin")
    const admin = createServiceRoleClient()
    const { error } = await admin.from("user_settings").select("user_id").limit(1)
    secretValid = !error
  } catch {
    secretConfigured = false
  }

  return NextResponse.json({
    ok: true,
    env: {
      supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      anonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      secretKey: secretConfigured,
      secretKeyValid: secretValid,
    },
    auth: {
      session: "POST with credentials:include (logged-in browser)",
      bearer: "POST with Authorization: Bearer <supabase_access_token>",
      apiKey: secretValid
        ? "POST with X-API-Key: <mt5_webhook_api_key from /api/mt5/settings>"
        : "requires valid SUPABASE_SECRET_KEY in .env.local",
    },
  })
}

/**
 * Dev: same pipeline as MT5 webhook — session cookie, Bearer JWT, or X-API-Key.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production." }, { status: 404 })
  }

  try {
    const { supabase: sessionClient, userCtx, mode } = await resolveMt5TestAuth(request)

    if (mode === "session" || mode === "bearer") {
      const { data: existing } = await sessionClient
        .from("user_settings")
        .select("user_id")
        .eq("user_id", userCtx.user_id)
        .maybeSingle()

      if (!existing) {
        await sessionClient.from("user_settings").upsert(
          {
            user_id: userCtx.user_id,
            ...DEFAULT_USER_SETTINGS,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        )
      }
    }

    let body: Partial<Mt5TradeWebhookPayload> = {}
    try {
      body = (await request.json()) as Partial<Mt5TradeWebhookPayload>
    } catch {
      body = {}
    }

    const payload: Mt5TradeWebhookPayload = {
      ...defaultTestPayload(),
      ...body,
      ticket: body.ticket != null ? String(body.ticket) : defaultTestPayload().ticket,
    }

    const ingestSupabase = pickIngestClient(sessionClient)
    console.log(
      `[MT5 Test] auth=${mode} user=${userCtx.user_id} ticket=${payload.ticket} ingest=${ingestSupabase === sessionClient ? "session" : "service_role"}`,
    )

    const result = await ingestMt5Trade(ingestSupabase, userCtx, payload)

    if (result.pipeline) {
      logKeyStages(result.pipeline)
      if (!result.pipeline.ok) {
        console.error(`[MT5 Test] FAILED at ${result.pipeline.failedAt}`)
      } else {
        console.log("[MT5 Test] ALL KEY STAGES OK")
      }
    }

    return NextResponse.json({
      ...result,
      authMode: mode,
      pipelineLog: result.pipeline ? formatPipelineReport(result.pipeline) : undefined,
      hint: `Refresh journal → ${result.trade_date} → open trade → Trade Intelligence panel.`,
    })
  } catch (error) {
    if (error instanceof Mt5WebhookError) {
      console.error(`[MT5 Test] ${error.statusCode}:`, error.message)
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("[MT5 Test] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "MT5 test trade failed" },
      { status: 500 },
    )
  }
}
