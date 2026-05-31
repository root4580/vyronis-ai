/**
 * Vyronis strategy scoring — weighted 0–100 trade evaluation for Vyronis Core Model.
 * @see lib/strategy/vyronis-core.ts
 */

import {
  VYRONIS_CORE_DOCTRINE_VERSION,
  VYRONIS_STRATEGY_SCORING,
} from "@/types/vyronis-branding"
import type {
  VyronisComponentResult,
  VyronisEvaluation,
  VyronisExecutionQuality,
  VyronisGrade,
  VyronisRecommendation,
  VyronisScoreBreakdown,
  VyronisScoreWeights,
  VyronisTradeInput,
} from "@/types/strategy"
import {
  evaluateEmotionalDiscipline,
  isEmotionStable,
  normalizeEmotionState,
} from "@/lib/psychology/emotion-filter"

/** Human-readable label for logs, UI, and AI agent context */
export const VYRONIS_STRATEGY_SCORING_LABEL = VYRONIS_STRATEGY_SCORING

export const VYRONIS_SCORE_WEIGHTS: VyronisScoreWeights = {
  htfAlignment: 25,
  aoiQuality: 20,
  structureShift: 15,
  confirmationCandle: 10,
  sessionTiming: 10,
  rrQuality: 10,
  emotionalDiscipline: 10,
}

export const VYRONIS_MAX_SCORE = Object.values(VYRONIS_SCORE_WEIGHTS).reduce(
  (sum, weight) => sum + weight,
  0,
)

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function componentRatio(result: VyronisComponentResult): number {
  if (result.maxPoints <= 0) return 0
  return result.points / result.maxPoints
}

export function gradeFromVyronisScore(score: number): VyronisGrade {
  if (score >= 90) return "A+"
  if (score >= 80) return "A"
  if (score >= 70) return "B"
  return "Skip"
}

export function recommendationFromGrade(
  grade: VyronisGrade,
  hardSkip: boolean,
): VyronisRecommendation {
  if (hardSkip || grade === "Skip") return "skip"
  if (grade === "B") return "reduce_size"
  if (grade === "A") return "execute"
  return "execute"
}

export function executionQualityFromScore(
  score: number,
  hardSkip: boolean,
): VyronisExecutionQuality {
  if (hardSkip) return "blocked"
  if (score >= 90) return "excellent"
  if (score >= 80) return "good"
  if (score >= 70) return "marginal"
  return "poor"
}

export type VyronisScoreComponents = {
  htfAlignment: VyronisComponentResult
  aoiQuality: VyronisComponentResult
  structureShift: VyronisComponentResult
  confirmationCandle: VyronisComponentResult
  sessionTiming: VyronisComponentResult
  rrQuality: VyronisComponentResult
  emotionalDiscipline: VyronisComponentResult
  emotionGlobalPenalty: number
  htfAligned: boolean
  emotionStable: boolean
}

export function scoreComponentsToBreakdown(
  components: Omit<
    VyronisScoreComponents,
    "emotionGlobalPenalty" | "htfAligned" | "emotionStable"
  >,
): VyronisScoreBreakdown {
  return {
    htfAlignment: components.htfAlignment.points,
    aoiQuality: components.aoiQuality.points,
    structureShift: components.structureShift.points,
    confirmationCandle: components.confirmationCandle.points,
    sessionTiming: components.sessionTiming.points,
    rrQuality: components.rrQuality.points,
    emotionalDiscipline: components.emotionalDiscipline.points,
  }
}

export function computeWeightedVyronisScore(
  components: Omit<
    VyronisScoreComponents,
    "emotionGlobalPenalty" | "htfAligned" | "emotionStable"
  >,
  emotionGlobalPenalty = 0,
): number {
  const weighted =
    componentRatio(components.htfAlignment) * VYRONIS_SCORE_WEIGHTS.htfAlignment +
    componentRatio(components.aoiQuality) * VYRONIS_SCORE_WEIGHTS.aoiQuality +
    componentRatio(components.structureShift) * VYRONIS_SCORE_WEIGHTS.structureShift +
    componentRatio(components.confirmationCandle) * VYRONIS_SCORE_WEIGHTS.confirmationCandle +
    componentRatio(components.sessionTiming) * VYRONIS_SCORE_WEIGHTS.sessionTiming +
    componentRatio(components.rrQuality) * VYRONIS_SCORE_WEIGHTS.rrQuality +
    componentRatio(components.emotionalDiscipline) *
      VYRONIS_SCORE_WEIGHTS.emotionalDiscipline

  return clamp(Math.round(weighted - emotionGlobalPenalty))
}

export function buildVyronisEvaluation(
  input: VyronisTradeInput,
  components: VyronisScoreComponents,
): VyronisEvaluation {
  const breakdown = scoreComponentsToBreakdown(components)
  let score = computeWeightedVyronisScore(components, components.emotionGlobalPenalty)

  const hardSkipReasons: string[] = []
  if (!components.htfAligned) {
    hardSkipReasons.push("HTF alignment missing or conflicted — Vyronis requires W/D/H4 permission.")
  }
  if (!components.emotionStable) {
    hardSkipReasons.push(
      `Emotional state "${normalizeEmotionState(input.emotion.state)}" is unstable — no trade.`,
    )
  }

  const hardSkip = hardSkipReasons.length > 0
  if (hardSkip) {
    score = Math.min(score, 69)
  }

  const grade = hardSkip ? "Skip" : gradeFromVyronisScore(score)
  const recommendation = recommendationFromGrade(grade, hardSkip)
  const executionQuality = executionQualityFromScore(score, hardSkip)

  const reasons = [
    ...components.htfAlignment.reasons,
    ...components.aoiQuality.reasons,
    ...components.structureShift.reasons,
    ...components.confirmationCandle.reasons,
    ...components.sessionTiming.reasons,
    ...components.rrQuality.reasons,
    ...components.emotionalDiscipline.reasons,
  ]

  const warnings = [
    ...components.htfAlignment.warnings,
    ...components.aoiQuality.warnings,
    ...components.structureShift.warnings,
    ...components.confirmationCandle.warnings,
    ...components.sessionTiming.warnings,
    ...components.rrQuality.warnings,
    ...components.emotionalDiscipline.warnings,
    ...hardSkipReasons,
  ]

  if (components.emotionGlobalPenalty > 0) {
    warnings.push(
      `Emotion penalty applied (−${components.emotionGlobalPenalty}): revenge/impulsive states heavily reduce score.`,
    )
  }

  if (grade === "Skip" && !hardSkip) {
    warnings.push("Score below 70 — Vyronis grade is Skip.")
  }

  return {
    score,
    grade,
    reasons: [...new Set(reasons)].slice(0, 12),
    warnings: [...new Set(warnings)].slice(0, 12),
    executionQuality,
    emotionalState: normalizeEmotionState(input.emotion.state),
    recommendation,
    breakdown,
    hardSkip,
    hardSkipReasons,
    doctrineVersion: VYRONIS_CORE_DOCTRINE_VERSION,
  }
}

/** Score emotional discipline component (delegates to psychology module). */
export function scoreEmotionalDisciplineComponent(
  input: VyronisTradeInput,
): Pick<VyronisScoreComponents, "emotionalDiscipline" | "emotionGlobalPenalty" | "emotionStable"> {
  const emotion = evaluateEmotionalDiscipline(
    input.emotion,
    VYRONIS_SCORE_WEIGHTS.emotionalDiscipline,
  )
  return {
    emotionalDiscipline: emotion.component,
    emotionGlobalPenalty: emotion.globalPenalty,
    emotionStable: isEmotionStable(emotion.state),
  }
}
