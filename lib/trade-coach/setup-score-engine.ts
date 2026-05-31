import { parseMistakeTags } from "@/lib/trade-form-config"
import { getTradeRiskReward } from "@/lib/trade-form-utils"
import { getTradeDisplayMistakeTags } from "@/lib/mistake-tags"
import type { PatternMemoryPattern } from "@/lib/trade-coach/pattern-memory"

export type SetupClassification =
  | "A+"
  | "A"
  | "B"
  | "Skip"
  | "C"
  | "Impulsive"
  | "Revenge"
  | "Counter-Trend"

export type SetupScoreBreakdown = {
  htfAlignment: number
  confirmation: number
  timing: number
  riskReward: number
  emotionalState: number
  ruleFollowing: number
}

export type SetupCoachingInsight = {
  id: string
  type: "positive" | "warning" | "pattern"
  message: string
}

export type SetupScoreTradeInput = {
  direction: string
  result: string
  emotion: string
  emotion_after?: string | null
  setup: string
  strategy_name?: string | null
  risk_percent?: number | null
  rule_followed?: boolean | null
  session?: string | null
  trade_date?: string | null
  confirmation_signal?: string | null
  higher_timeframe?: string | null
  entry_timeframe?: string | null
  confirmation_timeframe?: string | null
  mistake_tags?: string | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
  risk_reward?: number | null
}

export type SetupScoreInput = {
  trade: SetupScoreTradeInput
  maxRiskPerTrade?: number
  historicalTrades?: SetupScoreTradeInput[]
  patterns?: PatternMemoryPattern[]
}

export type SetupScoreResult = {
  score: number
  classification: SetupClassification
  breakdown: SetupScoreBreakdown
  insights: SetupCoachingInsight[]
  strengths: string[]
  warnings: string[]
}

const STABLE_EMOTIONS = new Set(["Calm", "Confident", "Disciplined"])
const IMPULSIVE_EMOTIONS = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful"])

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

const TIMING_PENALTY_TAGS = new Set(["Late entry", "Poor timing", "Wrong session", "Chased price"])
const IMPULSIVE_TAGS = new Set(["No plan", "Chased price", "Late entry", "No confirmation"])

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function isCounterTrend(trade: SetupScoreTradeInput): boolean {
  const signal = trade.confirmation_signal
  if (!signal) return false

  const bearish =
    BEARISH_SIGNALS.has(signal) ||
    signal.toLowerCase().includes("bearish") ||
    signal.toLowerCase().includes("resistance")
  const bullish =
    BULLISH_SIGNALS.has(signal) ||
    signal.toLowerCase().includes("bullish") ||
    signal.toLowerCase().includes("support") ||
    signal.toLowerCase().includes("hammer")

  if (trade.direction === "BUY" && bearish && !bullish) return true
  if (trade.direction === "SELL" && bullish && !bearish) return true
  return false
}

function getMistakeLabels(trade: SetupScoreTradeInput): Set<string> {
  return new Set(
    getTradeDisplayMistakeTags({
      direction: trade.direction,
      result: trade.result,
      pnl: 0,
      emotion: trade.emotion,
      emotion_after: trade.emotion_after,
      risk_percent: trade.risk_percent ?? null,
      rule_followed: trade.rule_followed ?? null,
      confirmation_signal: trade.confirmation_signal ?? null,
      mistake_tags: trade.mistake_tags,
    }).map((tag) => tag.label),
  )
}

function scoreHtfAlignment(trade: SetupScoreTradeInput): { score: number; strengths: string[]; warnings: string[] } {
  let score = 58
  const strengths: string[] = []
  const warnings: string[] = []

  if (trade.higher_timeframe?.trim()) {
    score += 14
    strengths.push(`HTF bias logged on ${trade.higher_timeframe}.`)
  } else {
    score -= 12
    warnings.push("No higher-timeframe bias recorded.")
  }

  if (trade.setup.includes("A+")) {
    score += 16
    strengths.push("A+ setup tier selected.")
  } else if (trade.setup.includes("B")) {
    score += 8
  } else if (trade.setup.includes("C")) {
    score -= 10
    warnings.push("C-grade setup lowers structural alignment.")
  }

  if (trade.entry_timeframe?.trim()) {
    score += 6
  }

  if (isCounterTrend(trade)) {
    score -= 22
    warnings.push("Trade direction conflicts with confirmation signal.")
  }

  return { score: clamp(score), strengths, warnings }
}

function scoreConfirmation(trade: SetupScoreTradeInput): { score: number; strengths: string[]; warnings: string[] } {
  let score = 55
  const strengths: string[] = []
  const warnings: string[] = []
  const labels = getMistakeLabels(trade)

  if (trade.confirmation_signal?.trim()) {
    score += 18
    strengths.push(`Confirmation: ${trade.confirmation_signal}.`)
  } else {
    score -= 18
    warnings.push("No confirmation signal logged.")
  }

  if (trade.confirmation_timeframe?.trim()) {
    score += 10
    strengths.push(`Confirmation timeframe: ${trade.confirmation_timeframe}.`)
  }

  if (labels.has("No Confirmation")) {
    score -= 14
    warnings.push("Missing confirmation inferred from trade data.")
  }

  if (!isCounterTrend(trade) && trade.confirmation_signal) {
    score += 8
    strengths.push("Confirmation aligns with trade direction.")
  }

  return { score: clamp(score), strengths, warnings }
}

function scoreTiming(trade: SetupScoreTradeInput): { score: number; strengths: string[]; warnings: string[] } {
  let score = 62
  const strengths: string[] = []
  const warnings: string[] = []
  const rawTags = parseMistakeTags(trade.mistake_tags)

  if (trade.session?.trim()) {
    score += 12
    strengths.push(`${trade.session} session logged.`)
  } else {
    score -= 8
    warnings.push("Session not recorded — timing context is weaker.")
  }

  if (trade.entry_timeframe?.trim()) {
    score += 8
  }

  for (const tag of rawTags) {
    if (TIMING_PENALTY_TAGS.has(tag)) {
      score -= 10
      warnings.push(`${tag} flagged — execution timing penalty.`)
    }
  }

  if (rawTags.length === 0 && trade.session) {
    score += 6
    strengths.push("Clean timing profile with no timing mistakes tagged.")
  }

  return { score: clamp(score), strengths, warnings }
}

function scoreRiskReward(
  trade: SetupScoreTradeInput,
  maxRiskPerTrade: number,
): { score: number; strengths: string[]; warnings: string[] } {
  let score = 60
  const strengths: string[] = []
  const warnings: string[] = []
  const labels = getMistakeLabels(trade)
  const rr = getTradeRiskReward(trade)
  const risk = trade.risk_percent ?? 0

  if (rr !== null) {
    if (rr >= 2.5) {
      score += 22
      strengths.push(`Strong R:R at 1:${rr.toFixed(1)}.`)
    } else if (rr >= 2) {
      score += 16
      strengths.push(`Solid R:R at 1:${rr.toFixed(1)}.`)
    } else if (rr >= 1.5) {
      score += 8
    } else {
      score -= 12
      warnings.push(`Low R:R at 1:${rr.toFixed(1)} — limited edge buffer.`)
    }
  } else if (trade.entry_price && trade.stop_loss && trade.take_profit) {
    score -= 6
    warnings.push("Price levels logged but R:R could not be computed.")
  } else {
    score -= 10
    warnings.push("No R:R data — risk planning incomplete.")
  }

  if (risk > 0 && risk <= maxRiskPerTrade) {
    score += 10
    strengths.push(`Risk ${risk}% within your ${maxRiskPerTrade}% cap.`)
  } else if (risk > maxRiskPerTrade) {
    score -= 16
    warnings.push(`Risk ${risk}% exceeds your ${maxRiskPerTrade}% max.`)
  }

  if (labels.has("Overrisk")) {
    score -= 12
    warnings.push("Oversizing detected.")
  }

  return { score: clamp(score), strengths, warnings }
}

function scoreEmotionalState(trade: SetupScoreTradeInput): { score: number; strengths: string[]; warnings: string[] } {
  let score = 70
  const strengths: string[] = []
  const warnings: string[] = []
  const labels = getMistakeLabels(trade)

  if (STABLE_EMOTIONS.has(trade.emotion)) {
    score += 14
    strengths.push(`${trade.emotion} emotional state supports disciplined execution.`)
  }

  if (trade.emotion === "FOMO" || labels.has("FOMO")) {
    score -= 24
    warnings.push("FOMO emotional state detected.")
  }

  if (trade.emotion === "Revenge") {
    score -= 30
    warnings.push("Revenge mindset detected before entry.")
  }

  if (trade.emotion === "Euphoric") {
    score -= 16
    warnings.push("Euphoric state increases impulsive sizing risk.")
  }

  if (trade.emotion === "Anxious" || trade.emotion === "Fearful") {
    score -= 10
    warnings.push("Fear/anxiety may distort execution quality.")
  }

  if (trade.emotion_after && STABLE_EMOTIONS.has(trade.emotion_after) && IMPULSIVE_EMOTIONS.has(trade.emotion)) {
    score += 4
    strengths.push("Emotional state recovered after the trade closed.")
  }

  return { score: clamp(score), strengths, warnings }
}

function scoreRuleFollowing(trade: SetupScoreTradeInput): { score: number; strengths: string[]; warnings: string[] } {
  let score = 68
  const strengths: string[] = []
  const warnings: string[] = []
  const rawTags = parseMistakeTags(trade.mistake_tags)

  if (trade.rule_followed === true) {
    score += 18
    strengths.push("Rules followed according to journal.")
  } else if (trade.rule_followed === false) {
    score -= 26
    warnings.push("Rule break logged — major discipline penalty.")
  }

  if (rawTags.includes("Ignored rules") || rawTags.includes("Moved stop")) {
    score -= 14
    warnings.push("Plan deviation tags detected.")
  }

  if (trade.rule_followed !== false && rawTags.length === 0) {
    score += 8
    strengths.push("Clean rule adherence with no mistake tags.")
  }

  return { score: clamp(score), strengths, warnings }
}

function deriveClassification(score: number, trade: SetupScoreTradeInput): SetupClassification {
  const labels = getMistakeLabels(trade)
  const rawTags = parseMistakeTags(trade.mistake_tags)

  if (trade.emotion === "Revenge" || labels.has("Revenge Trade") || rawTags.includes("Revenge trade")) {
    return "Revenge"
  }

  const impulsiveEmotion = IMPULSIVE_EMOTIONS.has(trade.emotion)
  const impulsiveTags = rawTags.some((tag) => IMPULSIVE_TAGS.has(tag))
  if (
    (trade.emotion === "FOMO" || trade.emotion === "Euphoric") &&
    (impulsiveTags || !trade.confirmation_signal)
  ) {
    return "Impulsive"
  }
  if (impulsiveEmotion && impulsiveTags) {
    return "Impulsive"
  }

  if (isCounterTrend(trade) || labels.has("Counter Trend")) {
    return "Counter-Trend"
  }

  if (score >= 85 && trade.rule_followed !== false && !IMPULSIVE_EMOTIONS.has(trade.emotion)) {
    return "A+"
  }
  if (score >= 68) return "B"
  return "C"
}

function buildPatternInsights(
  patterns: PatternMemoryPattern[],
  classification: SetupClassification,
): SetupCoachingInsight[] {
  const insights: SetupCoachingInsight[] = []

  for (const pattern of patterns.slice(0, 4)) {
    insights.push({
      id: `pattern-${pattern.id}`,
      type: pattern.severity === "positive" ? "positive" : "pattern",
      message: pattern.message,
    })
  }

  if (classification === "Revenge") {
    insights.push({
      id: "coach-revenge",
      type: "warning",
      message: "Revenge entries repeat your worst drawdown patterns — pause until emotional state resets.",
    })
  }

  if (classification === "Impulsive") {
    insights.push({
      id: "coach-impulsive",
      type: "warning",
      message: "Impulsive setups fail when confirmation is skipped — wait for structure before clicking in.",
    })
  }

  if (classification === "Counter-Trend") {
    insights.push({
      id: "coach-counter",
      type: "warning",
      message: "Counter-trend trades need HTF alignment first — trade with bias, not against it.",
    })
  }

  if (classification === "A+") {
    insights.push({
      id: "coach-aplus",
      type: "positive",
      message: "A+ process trade — replicate this checklist on the next session.",
    })
  }

  return insights.slice(0, 6)
}

function buildCoachingInsights(
  trade: SetupScoreTradeInput,
  breakdown: SetupScoreBreakdown,
  classification: SetupClassification,
  patterns: PatternMemoryPattern[],
): SetupCoachingInsight[] {
  const insights: SetupCoachingInsight[] = []

  const weakest = Object.entries(breakdown)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 2)

  for (const [key, value] of weakest) {
    if (value >= 70) continue
    const label =
      key === "htfAlignment"
        ? "HTF alignment"
        : key === "riskReward"
          ? "risk-reward"
          : key === "emotionalState"
            ? "emotional state"
            : key === "ruleFollowing"
              ? "rule-following"
              : key

    insights.push({
      id: `weak-${key}`,
      type: "warning",
      message: `${label.charAt(0).toUpperCase()}${label.slice(1)} scored ${value}/100 — focus here on the next trade.`,
    })
  }

  if (breakdown.confirmation >= 80 && breakdown.htfAlignment >= 80) {
    insights.push({
      id: "strong-structure",
      type: "positive",
      message: "Strong structural read — HTF bias and confirmation were both solid.",
    })
  }

  if (trade.result === "LOSS" && classification === "A+") {
    insights.push({
      id: "good-loss",
      type: "positive",
      message: "Loss with A+ process — outcome variance, not a process failure.",
    })
  }

  return [...insights, ...buildPatternInsights(patterns, classification)].slice(0, 6)
}

export function computeSetupScore(input: SetupScoreInput): SetupScoreResult {
  const trade = input.trade
  const maxRisk = input.maxRiskPerTrade ?? 1
  const patterns = input.patterns ?? []

  const htf = scoreHtfAlignment(trade)
  const confirmation = scoreConfirmation(trade)
  const timing = scoreTiming(trade)
  const riskReward = scoreRiskReward(trade, maxRisk)
  const emotionalState = scoreEmotionalState(trade)
  const ruleFollowing = scoreRuleFollowing(trade)

  const breakdown: SetupScoreBreakdown = {
    htfAlignment: htf.score,
    confirmation: confirmation.score,
    timing: timing.score,
    riskReward: riskReward.score,
    emotionalState: emotionalState.score,
    ruleFollowing: ruleFollowing.score,
  }

  const weightedScore = Math.round(
    breakdown.htfAlignment * 0.2 +
      breakdown.confirmation * 0.2 +
      breakdown.timing * 0.15 +
      breakdown.riskReward * 0.15 +
      breakdown.emotionalState * 0.15 +
      breakdown.ruleFollowing * 0.15,
  )

  const score = clamp(weightedScore)
  const classification = deriveClassification(score, trade)

  const strengths = [
    ...htf.strengths,
    ...confirmation.strengths,
    ...timing.strengths,
    ...riskReward.strengths,
    ...emotionalState.strengths,
    ...ruleFollowing.strengths,
  ]

  const warnings = [
    ...htf.warnings,
    ...confirmation.warnings,
    ...timing.warnings,
    ...riskReward.warnings,
    ...emotionalState.warnings,
    ...ruleFollowing.warnings,
  ]

  const insights = buildCoachingInsights(trade, breakdown, classification, patterns)

  return {
    score,
    classification,
    breakdown,
    insights,
    strengths: [...new Set(strengths)].slice(0, 5),
    warnings: [...new Set(warnings)].slice(0, 6),
  }
}

export function resolveStoredSetupScore(
  trade: {
    setup_score?: number | null
    setup_classification?: string | null
    setup_score_breakdown?: SetupScoreBreakdown | import("@/types/strategy").VyronisScoreBreakdown | null
    setup_coaching_insights?: SetupCoachingInsight[] | null
  } & SetupScoreTradeInput,
): SetupScoreResult {
  if (
    trade.setup_score != null &&
    trade.setup_classification &&
    trade.setup_score_breakdown
  ) {
    return {
      score: trade.setup_score,
      classification: trade.setup_classification as SetupClassification,
      breakdown: trade.setup_score_breakdown as SetupScoreBreakdown,
      insights: trade.setup_coaching_insights ?? [],
      strengths: [],
      warnings: [],
    }
  }

  return computeSetupScore({ trade })
}
