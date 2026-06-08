import { calculateRiskReward } from "@/lib/trade-form-utils"
import {
  BIAS_TIMEFRAMES,
  ENTRY_TIMEFRAMES,
  MTF_TIMEFRAME_IDS,
  type CoachMtfTimeframe,
} from "@/lib/coach/mtf-constants"
import type {
  MtfAnalysisResult,
  MtfBiasAnalysis,
  MtfBiasDirection,
  MtfEntryAnalysis,
  MtfScreenshotMap,
} from "@/lib/coach/mtf-types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import type { TradeQualityRecommendation } from "@/lib/trade-coach/trade-quality-engine"

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function biasFromDirection(tradeDirection?: string): MtfBiasDirection {
  if (tradeDirection === "BUY") return "bullish"
  if (tradeDirection === "SELL") return "bearish"
  return "neutral"
}

function inferTimeframeBias(
  timeframe: CoachMtfTimeframe,
  context: PreTradePlannedContext,
  hasScreenshot: boolean,
): MtfBiasDirection {
  if (!hasScreenshot) return "neutral"

  const direction = context.direction
  const htf = context.higher_timeframe?.toLowerCase() || ""

  if (timeframe === "weekly") {
    if (htf.includes("week") && htf.includes("bull")) return "bullish"
    if (htf.includes("week") && htf.includes("bear")) return "bearish"
    return biasFromDirection(direction)
  }

  if (timeframe === "daily") {
    if (htf.includes("daily") && htf.includes("bull")) return "bullish"
    if (htf.includes("daily") && htf.includes("bear")) return "bearish"
    if (htf.includes("d1") && direction === "BUY") return "bullish"
    if (htf.includes("d1") && direction === "SELL") return "bearish"
    return biasFromDirection(direction)
  }

  if (timeframe === "h4") {
    if (htf.includes("h4") && htf.includes("bull")) return "bullish"
    if (htf.includes("h4") && htf.includes("bear")) return "bearish"
    if (htf.includes("4h") && direction === "BUY") return "bullish"
    if (htf.includes("4h") && direction === "SELL") return "bearish"
    return biasFromDirection(direction)
  }

  return biasFromDirection(direction)
}

function resolveOverallBias(biases: MtfBiasDirection[]): MtfBiasDirection {
  const scored = biases.filter((bias) => bias !== "neutral")
  if (scored.length === 0) return "neutral"

  const bullish = scored.filter((bias) => bias === "bullish").length
  const bearish = scored.filter((bias) => bias === "bearish").length

  if (bullish > 0 && bearish > 0) return "mixed"
  if (bullish >= 2) return "bullish"
  if (bearish >= 2) return "bearish"
  if (bullish === 1 && bearish === 0) return "bullish"
  if (bearish === 1 && bullish === 0) return "bearish"
  return "mixed"
}

function scoreBiasAlignment(
  weeklyBias: MtfBiasDirection,
  dailyBias: MtfBiasDirection,
  h4Bias: MtfBiasDirection,
  tradeDirection?: string,
): { score: number; warnings: string[] } {
  const warnings: string[] = []
  const biases = [weeklyBias, dailyBias, h4Bias].filter((bias) => bias !== "neutral")
  let score = 55

  if (biases.length === 0) {
    warnings.push("No HTF bias charts uploaded — alignment score uses plan context only.")
    return { score: 42, warnings }
  }

  const overall = resolveOverallBias([weeklyBias, dailyBias, h4Bias])
  const alignedCount = biases.filter((bias) => bias === overall).length
  score += alignedCount * 12

  if (overall === "mixed") {
    score -= 22
    warnings.push("Weekly, Daily, and H4 biases conflict — HTF alignment is mixed.")
  }

  if (weeklyBias !== "neutral" && dailyBias !== "neutral" && weeklyBias !== dailyBias) {
    score -= 14
    warnings.push("Weekly and Daily bias conflict.")
  }

  if (dailyBias !== "neutral" && h4Bias !== "neutral" && dailyBias !== h4Bias) {
    score -= 10
    warnings.push("Daily and H4 structure conflict.")
  }

  const tradeBias = biasFromDirection(tradeDirection)
  if (tradeBias !== "neutral" && overall !== "neutral" && tradeBias !== overall && overall !== "mixed") {
    score -= 18
    warnings.push("Planned trade direction conflicts with HTF bias.")
  } else if (tradeBias !== "neutral" && overall === tradeBias) {
    score += 12
  }

  return { score: clamp(score), warnings: [...new Set(warnings)] }
}

export function analyzeMtfBias(
  screenshots: MtfScreenshotMap,
  context: PreTradePlannedContext,
): MtfBiasAnalysis {
  const weeklyBias = inferTimeframeBias("weekly", context, Boolean(screenshots.weekly))
  const dailyBias = inferTimeframeBias("daily", context, Boolean(screenshots.daily))
  const h4Bias = inferTimeframeBias("h4", context, Boolean(screenshots.h4))
  const overallBias = resolveOverallBias([weeklyBias, dailyBias, h4Bias])
  const { score, warnings } = scoreBiasAlignment(
    weeklyBias,
    dailyBias,
    h4Bias,
    context.direction,
  )

  return {
    weeklyBias,
    dailyBias,
    h4Bias,
    overallBias,
    biasAlignmentScore: score,
    biasWarnings: warnings,
  }
}

function scoreRr(context: PreTradePlannedContext): number {
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

function scoreH1Setup(
  screenshots: MtfScreenshotMap,
  context: PreTradePlannedContext,
  overallBias: MtfBiasDirection,
): number {
  if (!screenshots.h1) return 48

  let score = 62
  const signal = context.confirmation_signal || ""
  const setup = context.setup || ""

  if (signal) score += 14
  if (setup.includes("A+")) score += 12
  else if (setup.includes("B")) score += 6
  if (context.entry_timeframe?.toLowerCase().includes("h1")) score += 8

  const tradeBias = biasFromDirection(context.direction)
  if (tradeBias !== "neutral" && overallBias !== "neutral" && tradeBias === overallBias) {
    score += 10
  } else if (overallBias === "mixed") {
    score -= 8
  }

  score += (scoreRr(context) - 60) * 0.15
  return clamp(Math.round(score))
}

function scoreM15Entry(
  screenshots: MtfScreenshotMap,
  context: PreTradePlannedContext,
  h1Quality: number,
  overallBias: MtfBiasDirection,
): number {
  if (!screenshots.m15) return 45

  let score = 58
  const signal = context.confirmation_signal || ""

  if (signal) score += 16
  if (context.confirmation_timeframe?.toLowerCase().includes("m15")) score += 10
  if (h1Quality >= 70) score += 12
  else if (h1Quality < 50) score -= 10

  const tradeBias = biasFromDirection(context.direction)
  if (tradeBias !== "neutral" && overallBias !== "neutral") {
    if (tradeBias === overallBias) score += 14
    else score -= 16
  }

  const rr = scoreRr(context)
  if (rr >= 70) score += 8
  if (rr < 45) score -= 10

  return clamp(Math.round(score))
}

export function analyzeMtfEntry(
  screenshots: MtfScreenshotMap,
  context: PreTradePlannedContext,
  bias: MtfBiasAnalysis,
): MtfEntryAnalysis {
  const warnings: string[] = []
  const strengths: string[] = []

  const h1SetupQuality = scoreH1Setup(screenshots, context, bias.overallBias)
  const m15EntryQuality = scoreM15Entry(screenshots, context, h1SetupQuality, bias.overallBias)

  if (!screenshots.h1) {
    warnings.push("H1 setup chart missing — entry timing confidence reduced.")
  } else if (h1SetupQuality >= 75) {
    strengths.push("H1 setup structure looks clean.")
  } else if (h1SetupQuality < 50) {
    warnings.push("H1 setup quality is weak.")
  }

  if (!screenshots.m15) {
    warnings.push("M15 entry chart missing — confirmation confidence reduced.")
  } else if (m15EntryQuality >= 75) {
    strengths.push("M15 entry aligns with the planned trigger.")
  } else if (m15EntryQuality < 50) {
    warnings.push("M15 does not strongly confirm the entry.")
  }

  const tradeBias = biasFromDirection(context.direction)
  if (
    tradeBias !== "neutral" &&
    bias.overallBias !== "neutral" &&
    tradeBias !== bias.overallBias &&
    bias.overallBias !== "mixed"
  ) {
    warnings.push("H1/M15 entry does not confirm HTF bias direction.")
  } else if (
    tradeBias !== "neutral" &&
    bias.overallBias === tradeBias &&
    m15EntryQuality >= 70
  ) {
    strengths.push("M15 confirms HTF bias and planned direction.")
  }

  const rr = scoreRr(context)
  if (rr < 50) {
    warnings.push("R:R quality is thin for this entry structure.")
  } else if (rr >= 72) {
    strengths.push("R:R supports the entry plan.")
  }

  if (h1SetupQuality >= 70 && m15EntryQuality < 55) {
    warnings.push("Entry may be too early — H1 looks better than M15 confirmation.")
  }
  if (m15EntryQuality >= 75 && h1SetupQuality < 55) {
    warnings.push("Entry may be late — M15 trigger without strong H1 structure.")
  }

  const entryConfirmationScore = clamp(
    Math.round(h1SetupQuality * 0.45 + m15EntryQuality * 0.55),
  )

  return {
    h1SetupQuality,
    m15EntryQuality,
    entryConfirmationScore,
    entryWarnings: [...new Set(warnings)].slice(0, 6),
    entryStrengths: [...new Set(strengths)].slice(0, 5),
  }
}

function deriveRecommendation(
  overallScore: number,
  bias: MtfBiasAnalysis,
  entry: MtfEntryAnalysis,
): TradeQualityRecommendation {
  if (bias.overallBias === "mixed" && entry.entryConfirmationScore < 50) return "SKIP"

  const entryTriggersIncomplete =
    entry.entryConfirmationScore < 70 || entry.m15EntryQuality < 70

  if (entryTriggersIncomplete) {
    if (overallScore >= 48) return "CAUTION"
    return "SKIP"
  }

  if (overallScore >= 72 && bias.biasWarnings.length <= 1 && entry.entryWarnings.length <= 1) {
    return "TAKE"
  }
  if (overallScore >= 48) return "CAUTION"
  return "SKIP"
}

export function analyzeMultiTimeframeVision(input: {
  screenshots: MtfScreenshotMap
  context: PreTradePlannedContext
}): MtfAnalysisResult {
  const chartsMissing = MTF_TIMEFRAME_IDS.filter((tf) => !input.screenshots[tf])
  const chartsProvided = MTF_TIMEFRAME_IDS.length - chartsMissing.length
  const confidencePenalty = chartsMissing.length * 6

  const bias = analyzeMtfBias(input.screenshots, input.context)
  const entry = analyzeMtfEntry(input.screenshots, input.context, bias)

  let overallScore = clamp(
    Math.round(
      bias.biasAlignmentScore * 0.45 +
        entry.entryConfirmationScore * 0.45 +
        scoreRr(input.context) * 0.1 -
        confidencePenalty,
    ),
  )

  if (bias.overallBias === "mixed") overallScore -= 8
  if (
    bias.overallBias !== "neutral" &&
    biasFromDirection(input.context.direction) === bias.overallBias &&
    entry.entryConfirmationScore >= 70
  ) {
    overallScore += 8
  }

  overallScore = clamp(overallScore)
  const visionScore = overallScore
  const recommendation = deriveRecommendation(overallScore, bias, entry)

  const pair = input.context.pair || "Trade"
  const direction = input.context.direction || "setup"
  const summary =
    chartsProvided < 5
      ? `${pair} ${direction}: MTF read with ${chartsProvided}/5 charts — confidence reduced. HTF ${bias.overallBias}, entry ${entry.entryConfirmationScore}/100.`
      : `${pair} ${direction}: MTF aligned read — HTF ${bias.overallBias} (${bias.biasAlignmentScore}/100), entry confirmation ${entry.entryConfirmationScore}/100.`

  return {
    version: 1,
    bias,
    entry,
    chartsProvided,
    chartsMissing,
    confidencePenalty,
    overallScore,
    visionScore,
    recommendation,
    summary,
    analyzedAt: new Date().toISOString(),
  }
}

export function buildMtfAnalysisMessages(analysis: MtfAnalysisResult): string[] {
  const messages = [analysis.summary]

  messages.push(
    `HTF bias: Weekly ${analysis.bias.weeklyBias}, Daily ${analysis.bias.dailyBias}, H4 ${analysis.bias.h4Bias} → Overall ${analysis.bias.overallBias} (${analysis.bias.biasAlignmentScore}/100).`,
  )

  messages.push(
    `Entry read: H1 setup ${analysis.entry.h1SetupQuality}/100, M15 entry ${analysis.entry.m15EntryQuality}/100, confirmation ${analysis.entry.entryConfirmationScore}/100.`,
  )

  if (analysis.bias.biasWarnings.length > 0) {
    messages.push(`Bias warnings: ${analysis.bias.biasWarnings.slice(0, 2).join(" · ")}.`)
  }

  if (analysis.entry.entryWarnings.length > 0) {
    messages.push(`Entry warnings: ${analysis.entry.entryWarnings.slice(0, 2).join(" · ")}.`)
  }

  if (analysis.chartsProvided < 5) {
    messages.push(
      `${analysis.chartsMissing.length} chart(s) missing — score confidence is lower. Upload all 5 for best accuracy.`,
    )
  }

  messages.push("Quick check next — emotion, risk, and rules, then final trade quality score.")

  return messages
}

export function mtfAnalysisToChartAnalysis(
  analysis: MtfAnalysisResult,
  context: PreTradePlannedContext,
) {
  const rrQuality = scoreRr(context)
  const warnings = [
    ...analysis.entry.entryWarnings,
  ]
  const strengths = analysis.entry.entryStrengths

  if (analysis.chartsProvided < 5) {
    warnings.push(`${analysis.chartsMissing.length} timeframe chart(s) missing — reduced confidence.`)
  }

  return {
    overallScore: analysis.overallScore,
    executionQuality: analysis.entry.entryConfirmationScore,
    trendAlignment: analysis.bias.biasAlignmentScore,
    confirmationStrength: analysis.entry.m15EntryQuality,
    rrQuality,
    countertrend: analysis.bias.overallBias === "mixed",
    overextendedEntry: analysis.entry.entryWarnings.some((warning) =>
      warning.toLowerCase().includes("early") || warning.toLowerCase().includes("late"),
    ),
    warnings: [...new Set(warnings)].slice(0, 8),
    strengths: [...new Set(strengths)].slice(0, 6),
    summary: analysis.summary,
    insights: [
      `HTF ${analysis.bias.overallBias}`,
      `Bias ${analysis.bias.biasAlignmentScore}/100`,
      `Entry ${analysis.entry.entryConfirmationScore}/100`,
    ],
    mtf: analysis,
  }
}
