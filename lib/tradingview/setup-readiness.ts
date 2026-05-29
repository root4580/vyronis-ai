import { getMarketBias, getWeeklyPlanWithPairs } from "@/lib/strategy-brain/server-service"
import { getWeekStartSunday } from "@/lib/strategy-brain/week-utils"
import { evaluateMarketBias } from "@/lib/strategy-brain/market-bias-engine"
import { getWatchlistPairs, isWatchlistComplete } from "@/lib/strategy-brain/weekly-watchlist"
import { isTradingViewAlertEmailConfigured } from "@/lib/email/tradingview-alert-email"
import type { SupabaseClient } from "@supabase/supabase-js"

export type TradingViewSetupStep = {
  id: string
  label: string
  done: boolean
  hint: string
  action?: "war-room" | "settings" | "test-alert" | "resend-env"
}

export type TradingViewSetupReadiness = {
  ready: boolean
  steps: TradingViewSetupStep[]
  suggestedTestSymbol: string | null
  suggestedTestDirection: "BUY" | "SELL"
}

export async function getTradingViewSetupReadiness(
  supabase: SupabaseClient,
  userId: string,
  webhookEnabled: boolean,
  options?: { hasReceivedAlert?: boolean },
): Promise<TradingViewSetupReadiness> {
  let weekPlan = null
  let marketBias = null
  try {
    ;[weekPlan, marketBias] = await Promise.all([
      getWeeklyPlanWithPairs(supabase, userId, getWeekStartSunday()),
      getMarketBias(supabase, userId),
    ])
  } catch {
    // strategy brain tables may be missing
  }

  const pairs = getWatchlistPairs(weekPlan)
  const watchlistOk = isWatchlistComplete(weekPlan)
  const firstPair = pairs[0] ?? null
  const hasAoi = pairs.some((p) => p.aoi_high != null && p.aoi_low != null)
  const hasActiveAoi = pairs.some(
    (p) => p.aoi_status === "INSIDE_AOI" || p.aoi_status === "CONFIRMING",
  )
  const hasWarRoomCharts = pairs.some((p) => (p.screenshot_urls?.length ?? 0) > 0)
  const market = marketBias
    ? evaluateMarketBias({
        weekly_bias: marketBias.weekly_bias,
        daily_bias: marketBias.daily_bias,
        h4_bias: marketBias.h4_bias,
      })
    : null

  const steps: TradingViewSetupStep[] = [
    {
      id: "watchlist",
      label: "War Room watchlist",
      done: watchlistOk && pairs.length > 0,
      hint:
        pairs.length === 0
          ? "Add at least one pair in War Room."
          : `${pairs.length} pair(s): ${pairs.map((p) => p.pair).join(", ")}`,
      action: "war-room",
    },
    {
      id: "aoi",
      label: "AOI zones set",
      done: hasAoi,
      hint: hasAoi ? "AOI high/low on watchlist pairs." : "Set AOI range per pair in War Room.",
      action: "war-room",
    },
    {
      id: "bias",
      label: "HTF market bias",
      done: Boolean(market?.setup_valid),
      hint: market?.alignment_summary ?? "Set Weekly / Daily / H4 bias in War Room.",
      action: "war-room",
    },
    {
      id: "aoi-active",
      label: "AOI ready (not WAITING)",
      done: hasActiveAoi,
      hint: hasActiveAoi
        ? "At least one pair INSIDE_AOI or CONFIRMING."
        : "Mark AOI status when price is in zone — otherwise alerts grade C/D.",
      action: "war-room",
    },
    {
      id: "charts",
      label: "War Room chart uploads",
      done: hasWarRoomCharts,
      hint: hasWarRoomCharts
        ? "Alerts use your uploaded charts for AI vision (H4 preferred)."
        : "Upload Weekly/Daily/H4 screenshots per pair — vision runs on each alert.",
      action: "war-room",
    },
    {
      id: "webhook",
      label: "Webhook enabled",
      done: webhookEnabled,
      hint: webhookEnabled
        ? "Secret generated below — paste into TradingView."
        : "Open this settings section to auto-enable.",
      action: "settings",
    },
    {
      id: "test",
      label: "Test alert in Vyronis",
      done: Boolean(options?.hasReceivedAlert),
      hint: options?.hasReceivedAlert
        ? "At least one alert received — check the bell icon."
        : "Use the button below to simulate an alert (no TradingView needed).",
      action: "test-alert",
    },
    {
      id: "email",
      label: "Email for B+ alerts (optional)",
      done: isTradingViewAlertEmailConfigured(),
      hint: isTradingViewAlertEmailConfigured()
        ? "Resend configured — A+ / B alerts will email you."
        : "Add RESEND_API_KEY + RESEND_FROM_EMAIL to server env.",
      action: "resend-env",
    },
  ]

  const coreDone = steps.filter((s) => s.id !== "test" && s.id !== "email").every((s) => s.done)

  const suggestedTestSymbol = firstPair?.pair ?? "EURUSD"
  const suggestedTestDirection: "BUY" | "SELL" =
    firstPair?.directional_bias === "Bearish" ? "SELL" : "BUY"

  return {
    ready: coreDone,
    steps,
    suggestedTestSymbol,
    suggestedTestDirection,
  }
}
