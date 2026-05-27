import { detectTradingSession, sessionFitsPreference } from "@/lib/trading/session-timing"
import { computeRiskRewardRatio } from "@/lib/tradingview/signal-normalizer"
import type {
  TradingViewAiRecommendation,
  TradingViewSignalAnalysis,
} from "@/lib/tradingview/types"

function rrQuality(ratio: number | null): "poor" | "acceptable" | "strong" {
  if (ratio === null) return "acceptable"
  if (ratio >= 2) return "strong"
  if (ratio >= 1) return "acceptable"
  return "poor"
}

function htfScoreFromTimeframe(timeframe: string | null | undefined): number {
  if (!timeframe) return 55
  const tf = timeframe.toLowerCase()
  if (/(w|week|1d|d)/.test(tf)) return 85
  if (/(4h|240|h4)/.test(tf)) return 78
  if (/(1h|60|h1)/.test(tf)) return 68
  if (/(15|30|5|m)/.test(tf)) return 52
  return 60
}

function mapRecommendation(score: number): TradingViewAiRecommendation {
  if (score >= 72) return "TAKE"
  if (score >= 50) return "CAUTION"
  return "SKIP"
}

export function analyzeTradingViewSignal(input: {
  symbol: string
  direction: "BUY" | "SELL"
  timeframe?: string | null
  strategy_name?: string | null
  entry_zone?: string | null
  entry_price?: string | null
  stop_loss?: number | null
  take_profit?: number | null
  confidence?: number | null
  message?: string | null
  preferred_session?: string | null
}): TradingViewSignalAnalysis {
  const session = detectTradingSession()
  const fitsPreferred = sessionFitsPreference(session.name, input.preferred_session)
  const rrRatio = computeRiskRewardRatio({
    direction: input.direction,
    entry_price: input.entry_price,
    entry_zone: input.entry_zone,
    stop_loss: input.stop_loss,
    take_profit: input.take_profit,
  })
  const rrQ = rrQuality(rrRatio)
  const htfScore = htfScoreFromTimeframe(input.timeframe)

  const warnings: string[] = []
  const strengths: string[] = []

  if (rrQ === "poor") warnings.push("Risk/reward below 1:1 — review stop and target levels.")
  if (rrQ === "strong") strengths.push("Favorable risk/reward structure on alert levels.")
  if (!fitsPreferred) warnings.push(`Alert arrived outside your preferred session (${session.name}).`)
  if (fitsPreferred && session.isActive) strengths.push(`Active session alignment: ${session.name}.`)
  if (input.stop_loss == null || input.take_profit == null) {
    warnings.push("Stop loss or take profit missing — confirm levels before planning.")
  }

  const tvConfidence = input.confidence ?? 60
  let confidenceScore = Math.round(
    htfScore * 0.25 + tvConfidence * 0.35 + (rrRatio ? Math.min(rrRatio * 15, 30) : 12),
  )
  if (!fitsPreferred) confidenceScore -= 8
  if (rrQ === "poor") confidenceScore -= 12
  if (rrQ === "strong") confidenceScore += 6
  confidenceScore = Math.max(0, Math.min(100, confidenceScore))

  const recommendation = mapRecommendation(confidenceScore)
  const strategy = input.strategy_name ? ` · ${input.strategy_name}` : ""
  const summary =
    input.message?.trim() ||
    `${input.symbol} ${input.direction}${strategy} setup alert. Vyronis scored ${confidenceScore}/100 (${recommendation}).`

  return {
    htf_alignment: {
      score: htfScore,
      label: htfScore >= 75 ? "HTF supportive" : htfScore >= 55 ? "Mixed HTF context" : "LTF-only alert",
      notes: input.timeframe
        ? `Alert timeframe: ${input.timeframe}. Confirm higher-timeframe bias before entry.`
        : "No timeframe provided — validate HTF trend manually.",
    },
    risk_reward: {
      ratio: rrRatio,
      quality: rrQ,
    },
    session_timing: {
      session: session.name,
      fits_preferred: fitsPreferred,
      notes: session.isActive
        ? "Market session is active at alert time."
        : "Alert received during off-hours — plan for next session open.",
    },
    news_warning: {
      connected: false,
      message: "High-impact news filter not connected yet. Check economic calendar manually.",
    },
    confidence_score: confidenceScore,
    recommendation,
    summary,
    warnings,
    strengths,
  }
}
