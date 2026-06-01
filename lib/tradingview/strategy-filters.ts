import type { SupabaseClient } from "@supabase/supabase-js"
import { getWeeklyPlanWithPairs } from "@/lib/strategy-brain/server-service"
import { getWeekStartSunday } from "@/lib/strategy-brain/week-utils"
import { findPairOnWatchlist } from "@/lib/strategy-brain/weekly-watchlist"
import type { BiasDirection } from "@/lib/strategy-brain/types"
import type { TradingViewSignalAnalysis } from "@/lib/tradingview/types"

export type StrategyFilterRejectReason = "session" | "timeframe" | "bias"

export type StrategyFilterResult =
  | { passed: true; pairBias: BiasDirection | null }
  | {
      passed: false
      reason: StrategyFilterRejectReason
      detail: string
      notify: boolean
      userMessage?: string
    }

const ET_TIME_ZONE = "America/New_York"

/** London 2:00am – 5:00am ET (exclusive end). */
export function isLondonStrategyWindowEt(now: Date): boolean {
  const minutes = getEtMinutesOfDay(now)
  return minutes >= 2 * 60 && minutes < 5 * 60
}

/** New York 8:00am – 12:00pm ET (exclusive end). */
export function isNewYorkStrategyWindowEt(now: Date): boolean {
  const minutes = getEtMinutesOfDay(now)
  return minutes >= 8 * 60 && minutes < 12 * 60
}

export function isAllowedStrategySessionEt(now: Date): boolean {
  return isLondonStrategyWindowEt(now) || isNewYorkStrategyWindowEt(now)
}

function getEtMinutesOfDay(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now)

  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10)
  const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10)
  return hour * 60 + minute
}

export function normalizeTradingViewTimeframe(timeframe: string | null | undefined): string {
  return (timeframe ?? "").trim().toUpperCase().replace(/\s+/g, "")
}

/** Strategy accepts M15 only (15, 15M, M15, etc.). */
export function isM15Timeframe(timeframe: string | null | undefined): boolean {
  const normalized = normalizeTradingViewTimeframe(timeframe)
  if (!normalized) return false
  if (normalized === "M15" || normalized === "15" || normalized === "15M") return true
  if (normalized === "15MIN" || normalized === "15MINUTE" || normalized === "15MINUTES") {
    return true
  }
  return false
}

export function directionMatchesWatchlistBias(
  direction: "BUY" | "SELL",
  bias: BiasDirection | null | undefined,
): boolean {
  if (!bias || bias === "Neutral") return true
  if (direction === "BUY" && bias === "Bullish") return true
  if (direction === "SELL" && bias === "Bearish") return true
  return false
}

export async function evaluateTradingViewStrategyFilters(
  supabase: SupabaseClient,
  userId: string,
  input: {
    symbol: string
    direction: "BUY" | "SELL"
    timeframe: string | null
    receivedAt?: Date
  },
): Promise<StrategyFilterResult> {
  const receivedAt = input.receivedAt ?? new Date()

  if (!isAllowedStrategySessionEt(receivedAt)) {
    return {
      passed: false,
      reason: "session",
      detail: "Outside London (2–5am ET) and New York (8am–12pm ET) windows.",
      notify: false,
    }
  }

  if (!isM15Timeframe(input.timeframe)) {
    return {
      passed: false,
      reason: "timeframe",
      detail: `Timeframe must be M15 (received ${input.timeframe ?? "none"}).`,
      notify: false,
    }
  }

  let pairBias: BiasDirection | null = null
  try {
    const weekPlan = await getWeeklyPlanWithPairs(supabase, userId, getWeekStartSunday())
    const pairPlan = findPairOnWatchlist(input.symbol, weekPlan)
    if (!pairPlan) {
      return {
        passed: false,
        reason: "bias",
        detail: `${input.symbol} is not on this week's War Room watchlist.`,
        notify: true,
        userMessage: "⚠️ Against bias - skipped",
      }
    }

    pairBias = pairPlan.directional_bias ?? null
    if (!directionMatchesWatchlistBias(input.direction, pairBias)) {
      return {
        passed: false,
        reason: "bias",
        detail: `Alert is ${input.direction} but weekly bias is ${pairBias ?? "unknown"}.`,
        notify: true,
        userMessage: "⚠️ Against bias - skipped",
      }
    }
  } catch {
    return {
      passed: false,
      reason: "bias",
      detail: "Could not load War Room watchlist bias.",
      notify: true,
      userMessage: "⚠️ Against bias - skipped",
    }
  }

  return { passed: true, pairBias }
}

export function buildAPlusSetupNotification(symbol: string): string {
  return `🔥 A+ SETUP: ${symbol}`
}

export function applyStrategyFilterAPlusGrade(
  analysis: TradingViewSignalAnalysis,
  symbol: string,
  direction: "BUY" | "SELL",
): TradingViewSignalAnalysis {
  const notification = buildAPlusSetupNotification(symbol)
  return {
    ...analysis,
    setup_grade: "A+",
    setup_verdict: "trade_ready",
    meets_minimum_grade: true,
    recommendation: "TAKE",
    confidence_score: Math.max(analysis.confidence_score, 90),
    verdict_summary: `${symbol} ${direction} passed strategy filters — A+ setup.`,
    summary: `${symbol} ${direction} · Grade A+ · Trade ready · strategy filters passed`,
    strengths: [...analysis.strengths, notification],
  }
}
