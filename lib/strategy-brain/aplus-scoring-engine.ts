import { evaluateConfirmation } from "@/lib/strategy-brain/confirmation-engine"
import { biasAlignsWithPair } from "@/lib/strategy-brain/market-bias-engine"
import { evaluateBorderlineRecommendation } from "@/lib/strategy-brain/borderline-engine"
import type {
  BiasDirection,
  ConfirmationChecklist,
  ScoringBreakdown,
  ScoringInput,
  ScoringResult,
  ScoringRuleKey,
  SetupGrade,
  TradeRecommendation,
} from "@/lib/strategy-brain/types"

export const SCORING_RULE_POINTS: Record<ScoringRuleKey, number> = {
  weekly_aligned: 10,
  daily_aligned: 10,
  h4_aligned: 10,
  aoi_reached: 15,
  momentum_confirmation: 10,
  ema_confirmation: 5,
  clear_invalidation: 10,
  good_rr: 10,
  emotion_stable: 10,
  no_news_danger: 10,
}

export const SCORING_MAX = Object.values(SCORING_RULE_POINTS).reduce((a, b) => a + b, 0)

function checklistValue(
  v: boolean | "borderline",
): "yes" | "borderline" | "no" {
  if (v === true) return "yes"
  if (v === "borderline") return "borderline"
  return "no"
}

export function gradeFromScore(score: number): SetupGrade {
  if (score >= 90) return "A+"
  if (score >= 75) return "B"
  if (score >= 60) return "C"
  return "D"
}

export function calculateAPlusScore(input: ScoringInput): ScoringResult {
  const { marketBias, pairBias, confirmation, aoiReached, riskReward, emotionScore, majorNewsRisk } =
    input

  const breakdown: ScoringBreakdown = {
    weekly_aligned: 0,
    daily_aligned: 0,
    h4_aligned: 0,
    aoi_reached: 0,
    momentum_confirmation: 0,
    ema_confirmation: 0,
    clear_invalidation: 0,
    good_rr: 0,
    emotion_stable: 0,
    no_news_danger: 0,
  }

  const borderlineItems: string[] = []

  const weeklyAligns =
    marketBias.weekly_bias === pairBias ||
    (marketBias.weekly_bias !== "Neutral" && pairBias === marketBias.weekly_bias)
  if (weeklyAligns && marketBias.setup_valid) {
    breakdown.weekly_aligned = SCORING_RULE_POINTS.weekly_aligned
  } else if (marketBias.weekly_bias !== "Neutral" && pairBias !== "Neutral") {
    borderlineItems.push("Weekly bias")
  }

  const dailyAligns =
    marketBias.daily_bias === pairBias ||
    (marketBias.daily_bias === "Neutral" && marketBias.directional_permission)
  if (dailyAligns && marketBias.setup_valid) {
    breakdown.daily_aligned = SCORING_RULE_POINTS.daily_aligned
  } else if (marketBias.daily_bias !== "Neutral") {
    borderlineItems.push("Daily bias")
  }

  if (biasAlignsWithPair(marketBias, pairBias) && marketBias.h4_bias !== "Neutral") {
    breakdown.h4_aligned = SCORING_RULE_POINTS.h4_aligned
  } else if (marketBias.h4_bias !== "Neutral") {
    borderlineItems.push("H4 bias")
  }

  if (aoiReached) {
    breakdown.aoi_reached = SCORING_RULE_POINTS.aoi_reached
  }

  const mom = checklistValue(confirmation.momentum_confirmation)
  if (mom === "yes") breakdown.momentum_confirmation = SCORING_RULE_POINTS.momentum_confirmation
  else if (mom === "borderline") {
    borderlineItems.push("Momentum")
    breakdown.momentum_confirmation = Math.round(SCORING_RULE_POINTS.momentum_confirmation * 0.5)
  }

  const ema = checklistValue(confirmation.ema_confirmation)
  if (ema === "yes") breakdown.ema_confirmation = SCORING_RULE_POINTS.ema_confirmation
  else if (ema === "borderline") {
    borderlineItems.push("EMA")
    breakdown.ema_confirmation = Math.round(SCORING_RULE_POINTS.ema_confirmation * 0.5)
  }

  const inv = checklistValue(confirmation.clear_invalidation)
  if (inv === "yes") breakdown.clear_invalidation = SCORING_RULE_POINTS.clear_invalidation
  else if (inv === "borderline") {
    borderlineItems.push("Invalidation")
    breakdown.clear_invalidation = Math.round(SCORING_RULE_POINTS.clear_invalidation * 0.5)
  }

  const rr = checklistValue(confirmation.acceptable_rr)
  if (rr === "yes" || (riskReward !== null && riskReward >= 2)) {
    breakdown.good_rr = SCORING_RULE_POINTS.good_rr
  } else if (rr === "borderline" || (riskReward !== null && riskReward >= 1.5)) {
    borderlineItems.push("Risk-reward")
    breakdown.good_rr = Math.round(SCORING_RULE_POINTS.good_rr * 0.5)
  }

  if (emotionScore !== null && emotionScore >= 70) {
    breakdown.emotion_stable = SCORING_RULE_POINTS.emotion_stable
  } else if (emotionScore !== null && emotionScore >= 50) {
    borderlineItems.push("Emotion")
    breakdown.emotion_stable = Math.round(SCORING_RULE_POINTS.emotion_stable * 0.5)
  }

  if (!majorNewsRisk) {
    breakdown.no_news_danger = SCORING_RULE_POINTS.no_news_danger
  } else {
    borderlineItems.push("News risk")
  }

  const confEval = evaluateConfirmation(confirmation)
  borderlineItems.push(...confEval.borderline)

  const borderlineCount = new Set(borderlineItems).size

  const totalScore = Object.values(breakdown).reduce((a, b) => a + b, 0)
  const grade = gradeFromScore(totalScore)

  let recommendation: TradeRecommendation = "TAKE"
  let recommendationReason = "Process and structure support a planned execution."

  if (!marketBias.setup_valid) {
    recommendation = "SKIP"
    recommendationReason = marketBias.conflict_summary ?? "HTF bias conflict invalidates the setup."
  } else {
    const borderlineRec = evaluateBorderlineRecommendation({
      borderlineCount,
      grade,
      setupValid: marketBias.setup_valid,
      directionalPermission: marketBias.directional_permission,
    })
    recommendation = borderlineRec.recommendation
    recommendationReason = borderlineRec.reason
  }

  if (recommendation === "TAKE" && grade === "D") {
    recommendation = "SKIP"
    recommendationReason = "Score below minimum process threshold — protect capital and wait."
  } else if (recommendation === "TAKE" && grade === "C") {
    recommendation = "CAUTION"
    recommendationReason = "Marginal grade — reduce size or wait for additional confirmation."
  }

  return {
    totalScore,
    maxScore: SCORING_MAX,
    grade,
    breakdown,
    borderlineCount,
    borderlineItems: [...new Set(borderlineItems)],
    recommendation,
    recommendationReason,
  }
}
