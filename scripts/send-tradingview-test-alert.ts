/**
 * Send a Vyronis test TradingView alert (no browser / TradingView required).
 *
 *   npm run tv:test-alert
 *   npm run tv:test-alert -- GBPCAD BUY
 */
import { createClient } from "@supabase/supabase-js"
import { loadEnvLocal } from "./load-env-local"
import { ensureTradingViewWebhookSettings } from "../lib/tradingview/signal-server-service"
import { enrichTradingViewSignalChartVision } from "../lib/tradingview/signal-chart-vision-enrichment"
import { ingestTradingViewAlert } from "../lib/tradingview/webhook-server-service"
import { getWeeklyPlanWithPairs } from "../lib/strategy-brain/server-service"
import { getWeekStartSunday } from "../lib/strategy-brain/week-utils"

loadEnvLocal()

async function resolveUserId(
  admin: ReturnType<typeof createClient>,
): Promise<string | null> {
  const email = process.env.MT5_TEST_EMAIL?.trim()
  if (email) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
    const match = data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match?.id) return match.id
  }

  const { data: row } = await admin
    .from("user_settings")
    .select("user_id")
    .not("tradingview_webhook_secret", "is", null)
    .limit(1)
    .maybeSingle()

  if (row?.user_id) return row.user_id as string

  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1 })
  return authList?.users?.[0]?.id ?? null
}

function pickBestTestPair(
  weekPlan: Awaited<ReturnType<typeof getWeeklyPlanWithPairs>>,
): { symbol: string; direction: "BUY" | "SELL" } {
  const pairs = weekPlan?.pairs ?? []
  const score = (status: string) => {
    if (status === "CONFIRMING") return 4
    if (status === "INSIDE_AOI") return 3
    if (status === "WAITING") return 1
    return 0
  }
  const sorted = [...pairs].sort(
    (a, b) => score(b.aoi_status) - score(a.aoi_status),
  )
  const pick = sorted[0] ?? { pair: "GBPCAD", directional_bias: "Neutral" as const }
  const direction: "BUY" | "SELL" =
    pick.directional_bias === "Bearish"
      ? "SELL"
      : pick.directional_bias === "Bullish"
        ? "BUY"
        : "BUY"
  return { symbol: pick.pair, direction }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const secret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !secret) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
    process.exit(1)
  }

  const admin = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const userId = await resolveUserId(admin)
  if (!userId) {
    console.error("No user found. Log in once or set MT5_TEST_EMAIL in .env.local")
    process.exit(1)
  }

  const argSymbol = process.argv[2]?.trim().toUpperCase()
  const argDirection = process.argv[3]?.trim().toUpperCase()

  const weekPlan = await getWeeklyPlanWithPairs(admin, userId, getWeekStartSunday()).catch(
    () => null,
  )
  const fallback = pickBestTestPair(weekPlan)
  const symbol = argSymbol || fallback.symbol
  const direction: "BUY" | "SELL" =
    argDirection === "SELL" ? "SELL" : argDirection === "BUY" ? "BUY" : fallback.direction

  const settings = await ensureTradingViewWebhookSettings(admin, userId)

  const { result, chartVision } = await ingestTradingViewAlert(
    admin,
    {
      secret: settings.secret,
      symbol,
      direction,
      timeframe: "240",
      strategy_name: "Vyronis grade test",
      entry_zone: "AOI test",
      stop_loss: 1.844,
      take_profit: 1.87,
      confidence: 78,
      message: `Grade test for ${symbol} — check bell icon.`,
      chart_url: null,
      alert_id: `test-${Date.now()}`,
    },
    { source: "vyronis_test_alert", user_id: userId },
  )

  console.log("\nTradingView test alert sent")
  console.log("  Pair:", symbol, direction)
  console.log("  Grade:", result.setup_grade ?? "(see bell)")
  console.log("  Verdict:", result.setup_verdict ?? "—")
  console.log("  Message:", result.message ?? "—")

  if (chartVision) {
    console.log("\nRunning chart vision (War Room uploads or image_url)...")
    const { enriched, snapshot } = await enrichTradingViewSignalChartVision(admin, {
      userId: chartVision.userId,
      signalId: chartVision.signalId,
      coachSessionId: chartVision.coachSessionId,
      symbol: chartVision.normalized.symbol,
      direction: chartVision.normalized.direction,
      timeframe: chartVision.normalized.timeframe,
      strategy_name: chartVision.normalized.strategy_name,
      entry_zone: chartVision.normalized.entry_zone,
      entry_price: chartVision.normalized.entry_price,
      stop_loss: chartVision.normalized.stop_loss,
      take_profit: chartVision.normalized.take_profit,
      message: chartVision.normalized.message,
      chart_url: chartVision.normalized.chart_url,
      image_url: chartVision.image_url,
      screenshot_url: chartVision.screenshot_url,
      analysis: chartVision.analysis,
      maxRiskPerTrade: chartVision.maxRiskPerTrade,
    })
    if (enriched) {
      console.log("  Vision score:", snapshot.vision_score)
      console.log("  Source:", snapshot.image_source)
      console.log("  Summary:", snapshot.summary ?? "—")
    } else {
      console.log("  Vision skipped:", snapshot.skipped_reason ?? "—")
    }
  }

  console.log("\nRefresh the app and open the bell icon.\n")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
