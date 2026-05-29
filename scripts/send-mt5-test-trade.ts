/**
 * Send one test MT5 closed trade through the full pipeline with step-by-step logs.
 *
 *   npx tsx scripts/send-mt5-test-trade.ts
 *   npx tsx scripts/send-mt5-test-trade.ts --http
 *   npx tsx scripts/send-mt5-test-trade.ts --keep
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { createServiceRoleClient } from "../lib/supabase/admin"
import { getAppBaseUrl } from "../lib/env"
import { journalTradesOrFilter } from "../lib/analytics/trade-scope"
import { formatPipelineReport } from "../lib/mt5/pipeline-log"
import {
  ingestMt5Trade,
  resolveUserByMt5ApiKey,
} from "../lib/mt5/webhook-server-service"
import { ensureMt5WebhookSettings } from "../lib/mt5/settings-server-service"
import { buildTradeIntelligenceForTrade } from "../lib/intelligence/trade-intelligence-server"
import type { Mt5TradeWebhookPayload } from "../lib/mt5/types"

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local")
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function step(num: number, title: string, detail?: string) {
  console.log(`\n━━━ STEP ${num}: ${title} ━━━`)
  if (detail) console.log(detail)
}

loadEnvLocal()

const useHttp = process.argv.includes("--http")
const useAuth = process.argv.includes("--auth")
const keepTrade = process.argv.includes("--keep")

async function signInForTest(): Promise<string> {
  const email = process.env.MT5_TEST_EMAIL?.trim()
  const password = process.env.MT5_TEST_PASSWORD?.trim()
  if (!email || !password) {
    throw new Error(
      "Set MT5_TEST_EMAIL and MT5_TEST_PASSWORD in .env.local, or run from the browser console while logged in (see docs/MT5-EA-WEBHOOK.md).",
    )
  }

  const { createClient } = await import("@supabase/supabase-js")
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error || !data.session?.access_token) {
    throw new Error(error?.message || "Sign-in failed — check MT5_TEST_EMAIL / MT5_TEST_PASSWORD")
  }
  return data.session.access_token
}

async function main() {
  const ticket = `mt5-test-${Date.now()}`
  const payload: Mt5TradeWebhookPayload = {
    ticket,
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

  step(1, "MT5 test closed trade (simulated EA payload)", JSON.stringify(payload, null, 2))

  if (useAuth) {
    const token = await signInForTest()
    const url = `${getAppBaseUrl()}/api/mt5/test-closed-trade`
    step(2, "Authenticated pipeline test (dev)", `${url}\nUses your session — same ingest + intelligence as webhook`)
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    console.log(`HTTP ${response.status}`, JSON.stringify(body, null, 2))
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
    if (body.pipeline) {
      step(3, "Pipeline stage log", formatPipelineReport(body.pipeline))
      if (!body.pipeline.ok) throw new Error(`Pipeline failed at ${body.pipeline.failedAt}`)
    }
    if (!keepTrade && body.trade_id) {
      console.log("\n(Pass --keep to retain trade; auth mode did not auto-delete)\n")
    } else if (body.trade_id) {
      console.log(`\n✓ KEPT trade ${body.trade_id} — refresh calendar ${body.trade_date}\n`)
    }
    console.log("━━━ ALL STEPS PASSED (auth path) ━━━\n")
    return
  }

  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch (error) {
    console.error(
      "\nMissing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
        "Either add the server key from Supabase Dashboard → API Keys,\n" +
        "or run: npx tsx scripts/send-mt5-test-trade.ts --auth --keep\n" +
        "  (requires MT5_TEST_EMAIL + MT5_TEST_PASSWORD in .env.local)\n",
    )
    throw error
  }

  let apiKey = process.env.MT5_WEBHOOK_API_KEY?.trim()
  let userId: string

  if (apiKey) {
    const user = await resolveUserByMt5ApiKey(supabase, apiKey)
    userId = user.user_id
    step(2, "Webhook auth", `Using MT5_WEBHOOK_API_KEY → user_id=${userId}`)
  } else {
    const { data: settingsRow } = await supabase
      .from("user_settings")
      .select("user_id")
      .limit(1)
      .maybeSingle()

    if (!settingsRow?.user_id) {
      throw new Error("No user_settings row — sign up once in the app, then re-run.")
    }

    userId = settingsRow.user_id
    const ensured = await ensureMt5WebhookSettings(supabase, userId)
    apiKey = ensured.apiKey
    process.env.MT5_WEBHOOK_API_KEY = apiKey
    step(
      2,
      "Webhook auth (auto-provisioned)",
      `Enabled MT5 webhook for user_id=${userId}\nAPI key saved to process env for this run (add MT5_WEBHOOK_API_KEY to .env.local to persist).`,
    )
  }

  let result: Awaited<ReturnType<typeof ingestMt5Trade>>

  if (useHttp) {
    const url = `${getAppBaseUrl()}/api/webhooks/mt5/trades`
    step(3, "POST webhook", `${url}\nHeader: X-API-Key: [redacted]`)
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey!,
      },
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    console.log(`HTTP ${response.status}`, JSON.stringify(body, null, 2))
    if (!response.ok) throw new Error(`Webhook HTTP ${response.status}`)
    result = body as typeof result
  } else {
    step(3, "Webhook ingest (direct server path)", "ingestMt5Trade() — same logic as POST /api/webhooks/mt5/trades")
    const user = await resolveUserByMt5ApiKey(supabase, apiKey!)
    result = await ingestMt5Trade(supabase, user, payload)
    console.log(JSON.stringify(result, null, 2))
  }

  if (result.pipeline) {
    step(4, "Pipeline stage log", formatPipelineReport(result.pipeline))
    if (!result.pipeline.ok) {
      throw new Error(`Pipeline failed at stage: ${result.pipeline.failedAt}`)
    }
  }

  if (!result.trade_id || result.duplicate) {
    throw new Error(result.duplicate ? "Duplicate ticket — use a fresh run" : "No trade_id returned")
  }

  step(5, "Supabase save", `trade_id=${result.trade_id} | trade_date=${result.trade_date} | import_source=mt5_webhook`)

  const { data: trade } = await supabase
    .from("trades")
    .select("id, pair, trade_date, setup_score, setup_classification, pnl, result, import_source")
    .eq("id", result.trade_id)
    .single()

  console.log("Row:", trade)

  const { data: journalHit } = await supabase
    .from("trades")
    .select("id")
    .eq("user_id", userId)
    .or(journalTradesOrFilter())
    .eq("id", result.trade_id)

  step(
    6,
    "Journal calendar visibility",
    journalHit?.length === 1
      ? `✓ Trade is in journal query — open calendar day ${trade?.trade_date}`
      : "✗ Trade NOT in journal scope",
  )

  const bundle = await buildTradeIntelligenceForTrade(supabase, userId, result.trade_id)

  step(7, "Intelligence panel data", [
    `setup_score: ${bundle.setupScore.score} (${bundle.setupScore.classification})`,
    `discipline: ${bundle.disciplineScore} (${bundle.disciplineSource})`,
    `AI verdict: ${bundle.analysis.verdict}`,
    `summary: ${bundle.analysis.summary}`,
    `syncedAt: ${bundle.syncedAt ?? "(run Sync & analyze in UI if null)"}`,
  ].join("\n"))

  if (!keepTrade) {
    await supabase.from("trade_memory").delete().eq("trade_id", result.trade_id)
    await supabase.from("trades").delete().eq("id", result.trade_id)
    console.log("\n(Test trade removed — pass --keep to view in dashboard UI)\n")
  } else {
    console.log(`\n✓ KEPT trade ${result.trade_id} — refresh dashboard → calendar ${trade?.trade_date} → open trade → Trade Intelligence panel\n`)
  }

  console.log("━━━ ALL STEPS PASSED ━━━\n")
}

main().catch((error) => {
  console.error("\n━━━ PIPELINE FAILED ━━━\n", error instanceof Error ? error.message : error)
  process.exit(1)
})
