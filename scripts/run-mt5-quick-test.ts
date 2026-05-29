/**
 * Fastest local MT5 pipeline test — one fake trade → Supabase → intelligence.
 *
 *   npm run mt5:check-env
 *   npm run mt5:quick-test
 *
 * Uses (first match):
 *   - SUPABASE_SECRET_KEY + auto MT5 API key
 *   - MT5_TEST_EMAIL + MT5_TEST_PASSWORD (session ingest, no secret)
 *   - POST /api/mt5/test-closed-trade with Bearer (dev server)
 */
import { createClient } from "@supabase/supabase-js"
import { loadEnvLocal } from "./load-env-local"
import { formatPipelineReport } from "../lib/mt5/pipeline-log"
import { ensureMt5WebhookSettings } from "../lib/mt5/settings-server-service"
import { ingestMt5Trade } from "../lib/mt5/webhook-server-service"
import type { Mt5TradeWebhookPayload } from "../lib/mt5/types"
import { getAppBaseUrl } from "../lib/env"

const KEY_STAGES = [
  "normalize",
  "supabase_save",
  "journal_calendar",
  "intelligence_sync",
] as const

function printSuccessStages(pipeline: { stages: Array<{ stage: string; status: string; detail?: string; error?: string }> }) {
  console.log("\n--- Pipeline success log ---\n")
  for (const key of KEY_STAGES) {
    const stage = pipeline.stages.find((s) => s.stage === key)
    if (!stage) {
      console.log(`✗ ${key}: (missing)`)
      continue
    }
    const mark = stage.status === "ok" ? "✓" : stage.status === "skipped" ? "○" : "✗"
    const extra = stage.detail ? ` — ${stage.detail}` : stage.error ? ` — ${stage.error}` : ""
    console.log(`${mark} ${key}: ${stage.status}${extra}`)
  }
  console.log("")
}

function buildPayload(): Mt5TradeWebhookPayload {
  return {
    ticket: `mt5-quick-${Date.now()}`,
    symbol: "EURUSD",
    direction: "BUY",
    profit: 47.25,
    volume: 0.1,
    open_time: "2026.05.27 09:15:00",
    close_time: "2026.05.27 15:42:00",
    comment: "vyronis-mt5-quick-test",
    replace: false,
  }
}

async function runDirectIngest() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const secret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const email = process.env.MT5_TEST_EMAIL?.trim()
  const password = process.env.MT5_TEST_PASSWORD?.trim()

  const payload = buildPayload()
  console.log("\n[1] MT5 test payload:", payload.ticket, payload.symbol, payload.profit)

  if (secret) {
    const admin = createClient(url, secret, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const probe = await admin.from("user_settings").select("user_id").limit(1)
    if (probe.error) {
      console.error("Secret key invalid:", probe.error.message)
      console.error("Update SUPABASE_SECRET_KEY in .env.local from Supabase Dashboard.\n")
    } else {
      let apiKey = process.env.MT5_WEBHOOK_API_KEY?.trim()
      let userId = probe.data?.[0]?.user_id as string | undefined

      if (!userId) {
        const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1 })
        userId = authList?.users?.[0]?.id
      }

      if (!userId) {
        const email = `mt5.dev.${Date.now()}@vyronis.test`
        const password = `Mt5Dev!${Date.now().toString(36)}`
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        })
        if (createErr || !created.user) {
          throw new Error(createErr?.message || "No users in project — sign up at localhost:3000 first")
        }
        userId = created.user.id
        await admin.from("user_settings").upsert({
          user_id: userId,
          max_risk_per_trade: 1,
          starting_balance: 10000,
          updated_at: new Date().toISOString(),
        })
        console.log("\n[2] Created dev user:", email, "(password logged once below)")
        console.log("    password:", password)
      }

      if (userId) {
        const ensured = await ensureMt5WebhookSettings(admin, userId)
        apiKey = ensured.apiKey
        console.log("\n[2] Auth: X-API-Key path (service role)")
        console.log("    user_id:", userId)
        console.log("    apiKey:", `${apiKey.slice(0, 8)}… (save as MT5_WEBHOOK_API_KEY in .env.local)`)
      }

      if (apiKey && userId) {
        const { resolveUserByMt5ApiKey } = await import("../lib/mt5/webhook-server-service")
        const userCtx = await resolveUserByMt5ApiKey(admin, apiKey)
        console.log("\n[3] Ingest via webhook logic (service role)…\n")
        const result = await ingestMt5Trade(admin, userCtx, payload)
        if (result.pipeline) {
          printSuccessStages(result.pipeline)
          console.log(formatPipelineReport(result.pipeline))
        }
        console.log("trade_id:", result.trade_id, "| calendar day:", result.trade_date)
        console.log("\n✓ Open http://localhost:3000 → journal →", result.trade_date, "→ Trade Intelligence\n")
        return
      }
    }
  }

  if (email && password) {
    const sb = createClient(url, anon)
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error || !data.session) {
      throw new Error(error?.message || "Sign-in failed — check MT5_TEST_EMAIL / MT5_TEST_PASSWORD")
    }
    const authed = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    })
    console.log("\n[2] Auth: session (email/password)")
    console.log("    user_id:", data.user.id)

    const { data: settings } = await authed
      .from("user_settings")
      .select("max_risk_per_trade")
      .eq("user_id", data.user.id)
      .maybeSingle()

    const userCtx = {
      user_id: data.user.id,
      max_risk_per_trade: settings?.max_risk_per_trade ?? 1,
    }

    console.log("\n[3] Ingest via session client (RLS)…\n")
    const result = await ingestMt5Trade(authed, userCtx, payload)
    if (result.pipeline) {
      printSuccessStages(result.pipeline)
      console.log(formatPipelineReport(result.pipeline))
    }
    console.log("trade_id:", result.trade_id, "| calendar day:", result.trade_date)
    console.log("\n✓ Open http://localhost:3000 → journal →", result.trade_date, "→ Trade Intelligence\n")
    return
  }

  const base = getAppBaseUrl()
  console.log("\nNo valid secret key or MT5_TEST_EMAIL. Trying HTTP (dev server must be running)…")
  console.log(`POST ${base}/api/mt5/test-closed-trade with session cookie won't work from CLI.`)
  console.log("\nDo ONE of:")
  console.log("  A) Add SUPABASE_SECRET_KEY to .env.local → npm run mt5:quick-test")
  console.log("  B) Add MT5_TEST_EMAIL + MT5_TEST_PASSWORD → npm run mt5:quick-test")
  console.log("  C) Log in at localhost:3000, then in browser console:")
  console.log('     fetch("/api/mt5/test-closed-trade",{method:"POST",credentials:"include"}).then(r=>r.json()).then(console.log)')
  process.exit(1)
}

loadEnvLocal()
void runDirectIngest().catch((error) => {
  console.error("\n✗ Quick test failed:", error instanceof Error ? error.message : error)
  process.exit(1)
})
