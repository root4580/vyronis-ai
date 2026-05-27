import { detectCoachRedFlags } from "@/lib/trade-coach/red-flags"
import type { PatternMemoryPattern, PatternMemoryResult } from "@/lib/trade-coach/pattern-memory"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

export type TradeQualityGrade = "A" | "B" | "C" | "D" | "F"
export type TradeQualityRecommendation = "TAKE" | "SKIP" | "CAUTION"

export type TradeQualityBreakdown = {
  psychology: number
  risk: number
  setup: number
  discipline: number
  historicalEdge: number
  chart?: number
  biasAlignment?: number
  entryConfirmation?: number
}

export type TradeQualityHistoricalTrade = {
  direction: string
  result: string
  emotion: string
  strategy_name?: string | null
  session?: string | null
  risk_percent?: number | null
  rule_followed?: boolean | null
  confirmation_signal?: string | null
  trade_date?: string | null
  created_at: string
}

export type TradeQualityInput = {
  plannedContext: PreTradePlannedContext
  responses: Record<string, string>
  maxRiskPerTrade: number
  historicalTrades?: TradeQualityHistoricalTrade[]
  patternMemory?: Pick<PatternMemoryResult, "patterns"> | null
}

export type TradeQualityResult = {
  score: number
  grade: TradeQualityGrade
  recommendation: TradeQualityRecommendation
  confidence: number
  warnings: string[]
  strengths: string[]
  breakdown: TradeQualityBreakdown
  blockExecution: boolean
}

export const TRADE_QUALITY_BLOCK_THRESHOLD = 35

const IMPULSIVE_EMOTIONS = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful", "Greed"])
const STABLE_EMOTIONS = new Set(["Calm", "Confident", "Disciplined"])

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

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function parsePercent(value: string | undefined): number | null {
  if (!value) return null
  const parsed = parseFloat(value.replace("%", "").trim())
  return Number.isFinite(parsed) ? parsed : null
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

function getRecentTrades(trades: TradeQualityHistoricalTrade[], limit = 8): TradeQualityHistoricalTrade[] {
  return [...trades]
    .sort(
      (a, b) =>
        new Date(b.trade_date || b.created_at).getTime() -
        new Date(a.trade_date || a.created_at).getTime(),
    )
    .slice(0, limit)
}

function scorePsychology(
  responses: Record<string, string>,
  patterns: PatternMemoryPattern[],
): { score: number; warnings: string[]; strengths: string[] } {
  let score = 78
  const warnings: string[] = []
  const strengths: string[] = []
  const emotion = responses.emotional_state

  if (emotion === "FOMO") {
    score -= 24
    warnings.push("FOMO emotional state detected before entry.")
  }
  if (emotion === "Revenge") {
    score -= 32
    warnings.push("Revenge mindset detected — major psychology penalty.")
  }
  if (emotion === "Euphoric") {
    score -= 18
    warnings.push("Euphoric state increases oversizing risk.")
  }
  if (emotion === "Anxious" || emotion === "Fearful") {
    score -= 12
    warnings.push("Elevated fear/anxiety may distort execution.")
  }
  if (emotion && STABLE_EMOTIONS.has(emotion)) {
    score += 10
    strengths.push("Stable pre-trade emotional state.")
  }

  if (patterns.some((pattern) => pattern.id === "fomo-after-loss")) {
    score -= 12
    warnings.push("Pattern memory: you repeat FOMO entries after losses.")
  }
  if (patterns.some((pattern) => pattern.id === "euphoric-discipline-drop")) {
    score -= 8
    warnings.push("Pattern memory: discipline drops when emotion after = euphoric.")
  }

  return { score: clamp(score), warnings, strengths }
}

function scoreRisk(
  context: PreTradePlannedContext,
  responses: Record<string, string>,
  maxRiskPerTrade: number,
  patterns: PatternMemoryPattern[],
): { score: number; warnings: string[]; strengths: string[] } {
  let score = 80
  const warnings: string[] = []
  const strengths: string[] = []

  const plannedRisk =
    parsePercent(responses.planned_risk) ?? parsePercent(context.risk_percent) ?? null

  if (plannedRisk !== null && plannedRisk > maxRiskPerTrade) {
    score -= 24
    warnings.push(`Planned risk ${plannedRisk}% exceeds your ${maxRiskPerTrade}% max.`)
  } else if (plannedRisk !== null && plannedRisk <= maxRiskPerTrade) {
    score += 8
    strengths.push("Risk size stays within your max rule.")
  }

  if (!responses.planned_sl?.trim() && !context.stop_loss?.trim()) {
    score -= 16
    warnings.push("Missing planned stop loss.")
  }
  if (!responses.planned_tp?.trim() && !context.take_profit?.trim()) {
    score -= 10
    warnings.push("Missing planned take profit.")
  }

  if (patterns.some((pattern) => pattern.id === "repeated-overrisk")) {
    score -= 10
    warnings.push("Pattern memory: repeated over-risking detected.")
  }

  return { score: clamp(score), warnings, strengths }
}

function scoreSetup(
  context: PreTradePlannedContext,
  responses: Record<string, string>,
  patterns: PatternMemoryPattern[],
): { score: number; warnings: string[]; strengths: string[] } {
  const chartAnalysis = context.chart_analysis
  if (chartAnalysis) {
    const vision = chartAnalysis.vision
    const warnings = [...(chartAnalysis.warnings ?? [])]
    const strengths = [...(chartAnalysis.strengths ?? [])]
    const countertrend = vision?.metrics.countertrend ?? chartAnalysis.countertrend
    const overextended = vision?.metrics.overextendedMove ?? chartAnalysis.overextendedEntry
    if (countertrend) {
      warnings.push("Chart read flagged countertrend structure.")
    }
    if (overextended) {
      warnings.push("Chart read flagged overextended entry risk.")
    }
    if (patterns.some((pattern) => pattern.category === "countertrend")) {
      warnings.push("Pattern memory: countertrend trades have lower quality scores.")
    }
    if (patterns.some((pattern) => pattern.category === "chart_vision" && pattern.severity === "warning")) {
      warnings.push("Pattern memory: repeated chart vision mistakes detected.")
    }
    const scoreValue =
      vision?.visionScore ?? context.vision_score ?? chartAnalysis.overallScore
    return {
      score: clamp(scoreValue),
      warnings,
      strengths,
    }
  }

  let score = 72
  const warnings: string[] = []
  const strengths: string[] = []
  const setup = context.setup || ""

  if (setup.includes("A+")) {
    score += 14
    strengths.push("A+ setup quality bonus applied.")
  } else if (setup.includes("B")) {
    score += 5
  } else if (setup.includes("C")) {
    score -= 8
    warnings.push("C-grade setup lowers edge quality.")
  }

  if (isCounterTrend(context)) {
    score -= 18
    warnings.push("Countertrend signal conflict detected.")
  }

  if (patterns.some((pattern) => pattern.category === "countertrend")) {
    score -= 8
    warnings.push("Pattern memory: countertrend trades have lower quality scores.")
  }

  if (patterns.some((pattern) => pattern.category === "chart_vision" && pattern.severity === "warning")) {
    score -= 8
  }
  if (patterns.some((pattern) => pattern.category === "chart_vision" && pattern.severity === "positive")) {
    score += 6
  }

  return { score: clamp(score), warnings, strengths }
}

function scoreDiscipline(
  responses: Record<string, string>,
  historicalTrades: TradeQualityHistoricalTrade[],
  patterns: PatternMemoryPattern[],
): { score: number; warnings: string[]; strengths: string[] } {
  let score = 76
  const warnings: string[] = []
  const strengths: string[] = []

  if (responses.rule_check?.toLowerCase() === "no") {
    score -= 26
    warnings.push("You flagged a rule break before entry.")
  } else if (responses.rule_check?.toLowerCase() === "yes") {
    score += 8
    strengths.push("Pre-trade rule commitment looks solid.")
  }

  const recent = getRecentTrades(historicalTrades, 5)
  const recentBreaks = recent.filter((trade) => trade.rule_followed === false).length
  if (recentBreaks >= 2) {
    score -= Math.min(18, recentBreaks * 6)
    warnings.push("Recent rule breaks are dragging discipline score.")
  }

  const recentClean = recent.filter((trade) => trade.rule_followed !== false).length
  if (recent.length >= 3 && recentClean >= 3) {
    score += 8
    strengths.push("Recent discipline streak supports this entry.")
  }

  if (patterns.some((pattern) => pattern.id === "rule-break-after-win-streak")) {
    score -= 10
    warnings.push("Pattern memory: rule breaks spike after winning streaks.")
  }

  return { score: clamp(score), warnings, strengths }
}

function scoreHistoricalEdge(
  context: PreTradePlannedContext,
  historicalTrades: TradeQualityHistoricalTrade[],
  patterns: PatternMemoryPattern[],
): { score: number; warnings: string[]; strengths: string[] } {
  let score = 62
  const warnings: string[] = []
  const strengths: string[] = []

  const strategy = context.strategy_name?.trim()
  if (strategy && historicalTrades.length >= 3) {
    const strategyTrades = historicalTrades.filter((trade) => trade.strategy_name === strategy)
    if (strategyTrades.length >= 2) {
      const wins = strategyTrades.filter((trade) => trade.result === "WIN").length
      const winRate = wins / strategyTrades.length
      if (winRate >= 0.55) {
        score += 14
        strengths.push(`${strategy} has a strong historical win rate.`)
      } else if (winRate < 0.4) {
        score -= 14
        warnings.push(`${strategy} is underperforming in your journal.`)
      }
    }
  }

  const session = context.session?.trim()
  if (session && historicalTrades.length >= 3) {
    const sessionTrades = historicalTrades.filter((trade) => trade.session === session)
    if (sessionTrades.length >= 2) {
      const wins = sessionTrades.filter((trade) => trade.result === "WIN").length
      const winRate = wins / sessionTrades.length
      if (winRate >= 0.55) {
        score += 10
        strengths.push(`${session} session aligns with your best historical performance.`)
      } else if (winRate < 0.35) {
        score -= 12
        warnings.push(`${session} session is one of your weaker historical windows.`)
      }
    }
  }

  for (const pattern of patterns) {
    if (pattern.severity === "warning") {
      score -= 4
      if (pattern.category === "plan_gap") {
        warnings.push(`Pattern memory: ${pattern.message}`)
      }
    }
    if (pattern.severity === "positive" && pattern.category === "session") {
      score += 6
      strengths.push(pattern.message)
    }
    if (pattern.severity === "positive" && pattern.category === "strategy") {
      score += 5
      strengths.push(pattern.message)
    }
  }

  if (historicalTrades.length < 3) {
    score -= 6
    warnings.push("Limited historical sample — edge confidence is lower.")
  }

  return { score: clamp(score), warnings, strengths }
}

function deriveGrade(score: number): TradeQualityGrade {
  if (score >= 85) return "A"
  if (score >= 70) return "B"
  if (score >= 55) return "C"
  if (score >= 40) return "D"
  return "F"
}

function deriveRecommendation(
  score: number,
  warnings: string[],
  responses: Record<string, string>,
): TradeQualityRecommendation {
  if (responses.rule_check?.toLowerCase() === "no" || responses.emotional_state === "Revenge") {
    return "SKIP"
  }
  if (score >= 70 && warnings.length <= 2) return "TAKE"
  if (score >= 50) return "CAUTION"
  return "SKIP"
}

function deriveConfidence(
  input: TradeQualityInput,
  breakdown: TradeQualityBreakdown,
): number {
  let confidence = 55
  const historicalCount = input.historicalTrades?.length ?? 0
  const responseCount = Object.keys(input.responses).length

  confidence += Math.min(20, historicalCount * 4)
  confidence += Math.min(15, responseCount * 2)

  const avgBreakdown =
    (breakdown.psychology +
      breakdown.risk +
      breakdown.setup +
      breakdown.discipline +
      breakdown.historicalEdge) /
    5
  confidence += avgBreakdown >= 75 ? 8 : avgBreakdown >= 60 ? 4 : 0

  if ((input.patternMemory?.patterns.length ?? 0) > 0) {
    confidence += 6
  }

  return clamp(Math.round(confidence))
}

function resolveVisionScore(context: PreTradePlannedContext): number | null {
  const analysis = context.chart_analysis
  if (!analysis) return context.vision_score ?? null
  return analysis.vision?.visionScore ?? context.vision_score ?? analysis.overallScore ?? null
}

function resolveMtfScores(context: PreTradePlannedContext): {
  bias: number | null
  entry: number | null
  combined: number | null
} {
  const mtf = context.mtf_analysis ?? context.chart_analysis?.mtf
  if (mtf) {
    return {
      bias: mtf.bias.biasAlignmentScore,
      entry: mtf.entry.entryConfirmationScore,
      combined: mtf.overallScore ?? mtf.visionScore,
    }
  }
  const visionScore = resolveVisionScore(context)
  return { bias: null, entry: null, combined: visionScore }
}

export function computeTradeQuality(input: TradeQualityInput): TradeQualityResult {
  const patterns = input.patternMemory?.patterns ?? []
  const historicalTrades = input.historicalTrades ?? []
  const redFlags = detectCoachRedFlags(
    input.plannedContext,
    input.responses,
    input.maxRiskPerTrade,
  )

  const psychology = scorePsychology(input.responses, patterns)
  const risk = scoreRisk(input.plannedContext, input.responses, input.maxRiskPerTrade, patterns)
  const setup = scoreSetup(input.plannedContext, input.responses, patterns)
  const discipline = scoreDiscipline(input.responses, historicalTrades, patterns)
  const historicalEdge = scoreHistoricalEdge(input.plannedContext, historicalTrades, patterns)

  const mtfScores = resolveMtfScores(input.plannedContext)
  const breakdown: TradeQualityBreakdown = {
    psychology: psychology.score,
    risk: risk.score,
    setup: setup.score,
    discipline: discipline.score,
    historicalEdge: historicalEdge.score,
    ...(mtfScores.combined !== null ? { chart: mtfScores.combined } : {}),
    ...(mtfScores.bias !== null ? { biasAlignment: mtfScores.bias } : {}),
    ...(mtfScores.entry !== null ? { entryConfirmation: mtfScores.entry } : {}),
  }

  const weightedScore =
    mtfScores.bias !== null && mtfScores.entry !== null
      ? mtfScores.bias * 0.2 +
        mtfScores.entry * 0.2 +
        breakdown.psychology * 0.15 +
        breakdown.risk * 0.15 +
        breakdown.discipline * 0.1 +
        breakdown.historicalEdge * 0.1 +
        breakdown.setup * 0.1
      : mtfScores.combined !== null
        ? breakdown.chart! * 0.4 +
          breakdown.psychology * 0.15 +
          breakdown.risk * 0.15 +
          breakdown.setup * 0.1 +
          breakdown.discipline * 0.1 +
          breakdown.historicalEdge * 0.1
        : breakdown.psychology * 0.25 +
          breakdown.risk * 0.2 +
          breakdown.setup * 0.2 +
          breakdown.discipline * 0.2 +
          breakdown.historicalEdge * 0.15

  let score = clamp(Math.round(weightedScore))

  for (const flag of redFlags) {
    score -= flag.severity === "critical" ? 8 : 4
  }
  score = clamp(score)

  const warnings = [
    ...psychology.warnings,
    ...risk.warnings,
    ...setup.warnings,
    ...discipline.warnings,
    ...historicalEdge.warnings,
    ...redFlags.map((flag) => flag.message),
  ]

  const mtf = input.plannedContext.mtf_analysis ?? input.plannedContext.chart_analysis?.mtf
  if (mtf) {
    warnings.push(...mtf.bias.biasWarnings, ...mtf.entry.entryWarnings)
    if (mtf.chartsProvided < 5) {
      warnings.push(`${mtf.chartsMissing.length} MTF chart(s) missing — confidence reduced.`)
    }
  }
  const strengths = [
    ...psychology.strengths,
    ...risk.strengths,
    ...setup.strengths,
    ...discipline.strengths,
    ...historicalEdge.strengths,
  ]

  const uniqueWarnings = [...new Set(warnings)].slice(0, 8)
  const uniqueStrengths = [...new Set(strengths)].slice(0, 6)
  const grade = deriveGrade(score)
  const recommendation = deriveRecommendation(score, uniqueWarnings, input.responses)
  const confidence = deriveConfidence(input, breakdown)

  return {
    score,
    grade,
    recommendation,
    confidence,
    warnings: uniqueWarnings,
    strengths: uniqueStrengths,
    breakdown,
    blockExecution: score < TRADE_QUALITY_BLOCK_THRESHOLD,
  }
}
