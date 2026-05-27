import { calculateRiskReward } from "@/lib/trade-form-utils"
import type {
  ChartVisionBreakoutState,
  ChartVisionInput,
  ChartVisionMetrics,
  ChartVisionProvider,
  ChartVisionResult,
  ChartVisionTrendBias,
  ChartVisionVolatility,
} from "@/lib/coach/types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

const BEARISH_SIGNALS = new Set([
  "Head and Shoulders",
  "Double Top",
  "Triple Top",
  "Bearish Engulfing",
  "Evening Star",
  "Shooting Star",
  "Bear Flag",
  "Descending Triangle",
  "Resistance Rejection",
])

const BULLISH_SIGNALS = new Set([
  "Inverse Head and Shoulders",
  "Double Bottom",
  "Triple Bottom",
  "Bullish Engulfing",
  "Morning Star",
  "Hammer",
  "Bull Flag",
  "Ascending Triangle",
  "Support Rejection",
])

const RETEST_SIGNALS = new Set([
  "Support Rejection",
  "Resistance Rejection",
  "Hammer",
  "Shooting Star",
  "Morning Star",
  "Evening Star",
])

const BREAKOUT_SIGNALS = new Set(["Bull Flag", "Bear Flag", "Ascending Triangle", "Descending Triangle"])

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function isCounterTrend(context: PreTradePlannedContext): boolean {
  const signal = context.confirmation_signal
  const direction = context.direction
  if (!signal || !direction) return false

  const bearish =
    BEARISH_SIGNALS.has(signal) ||
    signal.toLowerCase().includes("bearish") ||
    signal.toLowerCase().includes("resistance")
  const bullish =
    BULLISH_SIGNALS.has(signal) ||
    signal.toLowerCase().includes("bullish") ||
    signal.toLowerCase().includes("support") ||
    signal.toLowerCase().includes("hammer")

  if (direction === "BUY" && bearish && !bullish) return true
  if (direction === "SELL" && bullish && !bearish) return true
  return false
}

function inferTrendBias(context: PreTradePlannedContext): ChartVisionTrendBias {
  const direction = context.direction
  const htf = context.higher_timeframe?.toLowerCase() || ""
  const signal = context.confirmation_signal || ""

  let bullishScore = 0
  let bearishScore = 0

  if (direction === "BUY") bullishScore += 2
  if (direction === "SELL") bearishScore += 2
  if (htf.includes("bull")) bullishScore += 2
  if (htf.includes("bear")) bearishScore += 2
  if (BULLISH_SIGNALS.has(signal)) bullishScore += 2
  if (BEARISH_SIGNALS.has(signal)) bearishScore += 2

  if (bullishScore > bearishScore + 1) return "bullish"
  if (bearishScore > bullishScore + 1) return "bearish"
  if (bullishScore === bearishScore) return "neutral"
  return "mixed"
}

function scoreEmaAlignment(context: PreTradePlannedContext, trendBias: ChartVisionTrendBias): number {
  let score = 62
  const htf = context.higher_timeframe?.toLowerCase() || ""
  const direction = context.direction

  if (htf.includes("ema") || htf.includes("ma")) score += 10
  if (direction === "BUY" && (htf.includes("above") || htf.includes("bull"))) score += 14
  if (direction === "SELL" && (htf.includes("below") || htf.includes("bear"))) score += 14
  if (direction === "BUY" && htf.includes("bear")) score -= 12
  if (direction === "SELL" && htf.includes("bull")) score -= 12

  if (trendBias === "bullish" && direction === "BUY") score += 8
  if (trendBias === "bearish" && direction === "SELL") score += 8
  if (trendBias === "mixed") score -= 6

  return clamp(score)
}

function scoreSupportResistanceProximity(context: PreTradePlannedContext): number {
  const signal = context.confirmation_signal || ""
  let score = 58

  if (signal.includes("Support") || signal.includes("Resistance")) score += 18
  if (signal.includes("Rejection")) score += 12
  if (context.setup?.includes("A+")) score += 10
  if (!signal) score -= 8

  return clamp(score)
}

function inferBreakoutState(context: PreTradePlannedContext): ChartVisionBreakoutState {
  const signal = context.confirmation_signal || ""
  if (BREAKOUT_SIGNALS.has(signal)) return "breakout"
  if (RETEST_SIGNALS.has(signal)) return "retest"
  if (signal.includes("Triangle") || signal.includes("Range")) return "range"
  return "unknown"
}

function scoreConfirmationCandle(context: PreTradePlannedContext): number {
  let score = 55
  const signal = context.confirmation_signal || ""
  const setup = context.setup || ""

  if (!signal) return 42
  score += 20
  if (setup.includes("A+")) score += 14
  else if (setup.includes("B")) score += 8
  if (context.confirmation_timeframe?.trim()) score += 6
  if (isCounterTrend(context)) score -= 16

  return clamp(score)
}

function scoreImpulsiveEntryDistance(context: PreTradePlannedContext): number {
  const rr = calculateRiskReward({
    direction: context.direction || "BUY",
    entry_price: context.entry_price || "",
    stop_loss: context.stop_loss || "",
    take_profit: context.take_profit || "",
  })

  if (rr === null) return 55

  if (rr < 0.8) return 88
  if (rr < 1) return 78
  if (rr < 1.5) return 62
  if (rr >= 2) return 28
  return 45
}

function inferVolatility(context: PreTradePlannedContext): ChartVisionVolatility {
  const session = context.session?.toLowerCase() || ""
  const setup = context.setup || ""

  if (session.includes("london") || session.includes("new york") || setup.includes("A+")) {
    return "expanded"
  }
  if (session.includes("asia") || setup.includes("C")) {
    return "compressed"
  }
  return "normal"
}

function scoreRrQuality(context: PreTradePlannedContext): number {
  const rr = calculateRiskReward({
    direction: context.direction || "BUY",
    entry_price: context.entry_price || "",
    stop_loss: context.stop_loss || "",
    take_profit: context.take_profit || "",
  })

  if (rr === null) return 52
  if (rr >= 2.5) return 92
  if (rr >= 2) return 84
  if (rr >= 1.5) return 72
  if (rr >= 1) return 58
  return 38
}

function detectSetup(context: PreTradePlannedContext): string {
  if (context.confirmation_signal) return context.confirmation_signal
  if (context.setup) return `${context.setup} structure`
  if (context.strategy_name) return `${context.strategy_name} setup`
  return "Unclassified chart setup"
}

function buildMetrics(context: PreTradePlannedContext): ChartVisionMetrics {
  const trendBias = inferTrendBias(context)
  const countertrend = isCounterTrend(context)
  const rrQuality = scoreRrQuality(context)
  const impulsiveEntryDistance = scoreImpulsiveEntryDistance(context)
  const overextendedMove = impulsiveEntryDistance >= 75 || rrQuality < 45

  return {
    trendDirection: trendBias,
    countertrend,
    rrQuality,
    impulsiveEntryDistance,
    emaAlignment: scoreEmaAlignment(context, trendBias),
    supportResistanceProximity: scoreSupportResistanceProximity(context),
    breakoutVsRetest: inferBreakoutState(context),
    confirmationCandleQuality: scoreConfirmationCandle(context),
    overextendedMove,
    volatilityState: inferVolatility(context),
  }
}

export const heuristicVisionProvider: ChartVisionProvider = {
  id: "heuristic",
  async analyze(input: ChartVisionInput): Promise<ChartVisionResult> {
    const context = input.plannedContext
    const metrics = buildMetrics(context)
    const detectedSetup = detectSetup(context)
    const warnings: string[] = []
    const strengths: string[] = []
    const insights: string[] = []

    if (metrics.countertrend) {
      warnings.push("Countertrend structure detected vs planned direction.")
      insights.push("Countertrend conflict")
    } else if (metrics.emaAlignment >= 75) {
      strengths.push("EMA / trend alignment supports the trade bias.")
      insights.push("EMA aligned")
    }

    if (metrics.overextendedMove) {
      warnings.push("Overextended move — entry may be late or impulsive.")
      insights.push("Overextended entry")
    }

    if (metrics.rrQuality >= 72) {
      strengths.push("R:R quality looks trader-ready.")
      insights.push("Strong R:R")
    } else if (metrics.rrQuality < 50) {
      warnings.push("Weak R:R — edge may be too thin.")
      insights.push("Weak R:R")
    }

    if (metrics.supportResistanceProximity >= 72) {
      strengths.push("Price action is interacting with key S/R.")
      insights.push("S/R proximity favorable")
    }

    if (metrics.breakoutVsRetest === "retest") {
      strengths.push("Retest-style confirmation improves location quality.")
      insights.push("Retest confirmation")
    } else if (metrics.breakoutVsRetest === "breakout") {
      insights.push("Breakout-style structure")
      if (metrics.volatilityState === "compressed") {
        warnings.push("Breakout into compressed volatility — watch for fakeouts.")
      }
    }

    if (metrics.confirmationCandleQuality >= 75) {
      strengths.push("Confirmation candle quality is strong.")
    } else if (metrics.confirmationCandleQuality < 50) {
      warnings.push("Confirmation candle quality is weak or missing.")
    }

    if (metrics.volatilityState === "expanded") {
      insights.push("Expanded volatility session")
    }

    const executionQuality = clamp(
      Math.round(
        metrics.confirmationCandleQuality * 0.25 +
          metrics.emaAlignment * 0.2 +
          metrics.supportResistanceProximity * 0.15 +
          metrics.rrQuality * 0.25 +
          (100 - metrics.impulsiveEntryDistance) * 0.15,
      ),
    )

    const visionScore = clamp(
      Math.round(
        executionQuality * 0.35 +
          metrics.emaAlignment * 0.2 +
          metrics.confirmationCandleQuality * 0.2 +
          metrics.rrQuality * 0.15 +
          metrics.supportResistanceProximity * 0.1,
      ),
    )

    if (metrics.countertrend) {
      // penalize in score already via warnings flow in quality engine
    }

    const pair = context.pair || "Chart"
    const direction = context.direction || "setup"
    const summary =
      visionScore >= 75
        ? `${pair} ${direction}: Chart Vision read is high quality (${visionScore}/100) — ${detectedSetup}.`
        : visionScore >= 55
          ? `${pair} ${direction}: mixed chart vision read (${visionScore}/100) — stay disciplined.`
          : `${pair} ${direction}: low chart vision score (${visionScore}/100).`

    const confidence = clamp(
      Math.round(
        52 +
          (context.confirmation_signal ? 12 : 0) +
          (context.stop_loss && context.take_profit ? 10 : 0) +
          (metrics.rrQuality >= 60 ? 8 : 0) +
          (input.screenshotUrl ? 10 : 0),
      ),
    )

    return {
      version: 2,
      visionScore,
      detectedSetup,
      trendBias: metrics.trendDirection,
      warnings: [...new Set(warnings)].slice(0, 6),
      strengths: [...new Set(strengths)].slice(0, 5),
      executionQuality,
      confidence,
      metrics,
      provider: "heuristic",
      analyzedAt: new Date().toISOString(),
      summary,
      insights: [...new Set(insights)].slice(0, 6),
    }
  },
}
