/**
 * End-to-end MT5 webhook pipeline validation.
 *
 * Direct ingest (no dev server):
 *   npx tsx scripts/validate-mt5-pipeline.ts
 *
 * HTTP webhook (dev server must be running):
 *   npx tsx scripts/validate-mt5-pipeline.ts --http
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY_VYRONIS)
 *   MT5_WEBHOOK_API_KEY  (from GET /api/mt5/settings while logged in)
 *
 * Optional: --keep to leave the test trade in Supabase
 */
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { createServiceRoleClient } from "../lib/supabase/admin"
import { getAppBaseUrl } from "../lib/env"
import { journalTradesOrFilter } from "../lib/analytics/trade-scope"
import { formatPipelineReport } from "../lib/mt5/pipeline-log"
import {
  ingestMt5Trade,
  resolveUserByMt5ApiKey,
  type Mt5WebhookUserContext,
} from "../lib/mt5/webhook-server-service"
import { buildTradeIntelligenceForTrade } from "../lib/intelligence/trade-intelligence-server"
import type { Mt5TradeWebhookPayload } from "../lib/mt5/types"

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local")
  if (!existsSync(path)) return
  const raw = readFileSync(path, "utf8")
  for (const line of raw.split("\n")) {
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

loadEnvLocal()

const useHttp = process.argv.includes("--http")
const keepTrade = process.argv.includes("--keep")

async function resolveApiKey(supabase: ReturnType<typeof createServiceRoleClient>): Promise<{
  apiKey: string
  user: Mt5WebhookUserContext
}> {
  const fromEnv = process.env.MT5_WEBHOOK_API_KEY?.trim()
  if (fromEnv) {
    const user = await resolveUserByMt5ApiKey(supabase, fromEnv)
    return { apiKey: fromEnv, user }
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("user_id, max_risk_per_trade, mt5_webhook_api_key, mt5_webhook_enabled")
    .eq("mt5_webhook_enabled", true)
    .not("mt5_webhook_api_key", "is", null)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data?.mt5_webhook_api_key) {
    throw new Error(
      "Set MT5_WEBHOOK_API_KEY in .env.local or enable webhook in user_settings (GET /api/mt5/settings).",
    )
  }

  return {
    apiKey: data.mt5_webhook_api_key,
    user: {
      user_id: data.user_id,
      max_risk_per_trade: data.max_risk_per_trade ?? 1,
    },
  }
}

function buildTestPayload(ticket: string): Mt5TradeWebhookPayload {
  return {
    ticket,
    symbol: "EURUSD",
    direction: "BUY",
    profit: 42.5,
    volume: 0.1,
    open_time: "2026.05.27 09:00:00",
    close_time: "2026.05.27 14:30:00",
    comment: "vyronis-e2e-pipeline-test",
    replace: false,
  }
}

async function main() {
  const supabase = createServiceRoleClient()
  const { apiKey, user } = await resolveApiKey(supabase)
  const ticket = `e2e-${Date.now()}`
  const payload = buildTestPayload(ticket)

  console.log("\n=== MT5 pipeline E2E validation ===\n")
  console.log(`Mode: ${useHttp ? "HTTP webhook" : "direct ingest"}`)
  console.log(`User: ${user.user_id}`)
  console.log(`Ticket: ${ticket}\n`)

  let result: Awaited<ReturnType<typeof ingestMt5Trade>>

  if (useHttp) {
    const base = getAppBaseUrl()
    const url = `${base}/api/webhooks/mt5/trades`
    console.log(`POST ${url}`)
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(payload),
    })
    const body = await response.json()
    if (!response.ok) {
      console.error("HTTP failed:", response.status, body)
      process.exit(1)
    }
    result = body as typeof result
  } else {
    result = await ingestMt5Trade(supabase, user, payload)
  }

  console.log("Webhook result:", {
    ok: result.ok,
    duplicate: result.duplicate,
    trade_id: result.trade_id,
    trade_date: result.trade_date,
    message: result.message,
  })

  if (result.pipeline) {
    console.log("\n--- Pipeline stages ---\n")
    console.log(formatPipelineReport(result.pipeline))
    assert.equal(result.pipeline.ok, true, `pipeline failed at ${result.pipeline.failedAt}`)
  } else {
    console.warn("WARN: no pipeline report on response")
  }

  assert.ok(result.trade_id, "expected trade_id")
  assert.equal(result.duplicate, false, "expected new trade, not duplicate")

  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("id, pair, trade_date, import_source, setup_score, setup_classification, pnl, result")
    .eq("id", result.trade_id)
    .single()

  assert.ifError(tradeError)
  assert.equal(trade?.import_source, "mt5_webhook", "import_source must be mt5_webhook")
  assert.ok(trade?.trade_date, "trade_date required for calendar")
  assert.ok(trade?.setup_score != null, "setup_score must be persisted")

  const { data: journalRows, error: journalError } = await supabase
    .from("trades")
    .select("id")
    .eq("user_id", user.user_id)
    .or(journalTradesOrFilter())
    .eq("id", result.trade_id)

  assert.ifError(journalError)
  assert.equal(journalRows?.length, 1, "trade must appear in journal scope query")

  const bundle = await buildTradeIntelligenceForTrade(supabase, user.user_id, result.trade_id!)
  assert.ok(bundle.setupScore.score > 0, "setup score in intelligence bundle")
  assert.ok(bundle.analysis.summary.length > 0, "AI summary present")
  assert.ok(bundle.disciplineScore >= 0, "discipline score present")

  console.log("\n--- Intelligence bundle ---\n")
  console.log({
    setupScore: bundle.setupScore.score,
    classification: bundle.setupScore.classification,
    discipline: bundle.disciplineScore,
    verdict: bundle.analysis.verdict,
    summary: bundle.analysis.summary.slice(0, 120),
    syncedAt: bundle.syncedAt,
  })

  if (!keepTrade) {
    await supabase.from("trade_memory").delete().eq("trade_id", result.trade_id)
    await supabase.from("trades").delete().eq("id", result.trade_id)
    console.log("\nCleaned up test trade (pass --keep to retain).\n")
  } else {
    console.log(`\nKept trade ${result.trade_id} on calendar day ${trade?.trade_date}\n`)
  }

  console.log("✓ MT5 end-to-end pipeline validation passed\n")
}

main().catch((error) => {
  console.error("\n✗ MT5 pipeline validation failed:\n", error)
  process.exit(1)
})
