/**
 * Vyronis Core Model — centralized strategy doctrine.
 *
 * Evaluates trades against HTF alignment, AOI, liquidity, structure (CHoCH/BOS),
 * engulfing confirmation, session, RR, news proximity, and emotion filters.
 *
 * Designed for modular extension: TradingView alerts, screenshot AI, MT5 history,
 * multi-agent debate, setup similarity, and historical pattern comparison.
 */

import {
  VYRONIS_CORE_DOCTRINE_ID,
  VYRONIS_CORE_MODEL,
} from "@/types/vyronis-branding"
import type {
  VyronisBiasDirection,
  VyronisComponentResult,
  VyronisDirection,
  VyronisEvaluation,
  VyronisHtfBias,
  VyronisTradeInput,
} from "@/types/strategy"
import {
  buildVyronisEvaluation,
  scoreEmotionalDisciplineComponent,
  type VyronisScoreComponents,
} from "@/lib/scoring/trade-score"
import { VYRONIS_SCORE_WEIGHTS } from "@/lib/scoring/trade-score"

export const VYRONIS_DOCTRINE = {
  id: VYRONIS_CORE_DOCTRINE_ID,
  version: "1.0.0",
  name: VYRONIS_CORE_MODEL,
  description:
    "Top-down HTF alignment → AOI → liquidity sweep → CHoCH/BOS → engulfing → session → RR → news → emotion.",
  minimumRr: 2,
  gradeThresholds: {
    aPlus: 90,
    a: 80,
    b: 70,
  },
} as const

export { VYRONIS_SCORE_WEIGHTS } from "@/lib/scoring/trade-score"
export {
  gradeFromVyronisScore,
  computeWeightedVyronisScore,
} from "@/lib/scoring/trade-score"
export {
  evaluateEmotionalDiscipline,
  isEmotionStable,
  normalizeEmotionState,
} from "@/lib/psychology/emotion-filter"

function isDirectional(bias: VyronisBiasDirection): boolean {
  return bias === "bullish" || bias === "bearish"
}

function dominantHtfBias(htf: VyronisHtfBias): VyronisBiasDirection | null {
  const layers = [htf.weekly, htf.daily, htf.h4]
  const directional = layers.filter(isDirectional)
  if (directional.length === 0) return null

  const bullish = directional.every((b) => b === "bullish")
  const bearish = directional.every((b) => b === "bearish")
  if (bullish) return "bullish"
  if (bearish) return "bearish"

  if (conflicts(htf.weekly, htf.daily) || conflicts(htf.weekly, htf.h4) || conflicts(htf.daily, htf.h4)) {
    return null
  }

  const nonNeutral = directional[0]
  return layers.every((b) => b === "neutral" || b === nonNeutral) ? nonNeutral : null
}

function conflicts(a: VyronisBiasDirection, b: VyronisBiasDirection): boolean {
  if (!isDirectional(a) || !isDirectional(b)) return false
  return a !== b
}

function tradeAlignsWithBias(tradeDirection: VyronisDirection, bias: VyronisBiasDirection): boolean {
  if (tradeDirection === "neutral" || bias === "neutral") return true
  return (
    (tradeDirection === "long" && bias === "bullish") ||
    (tradeDirection === "short" && bias === "bearish")
  )
}

/** Weekly / Daily / H4 alignment — max 25 pts */
export function evaluateHtfAlignment(htf: VyronisHtfBias): VyronisComponentResult & { aligned: boolean } {
  const maxPoints = VYRONIS_SCORE_WEIGHTS.htfAlignment
  const reasons: string[] = []
  const warnings: string[] = []
  let points = 0

  const conflict =
    conflicts(htf.weekly, htf.daily) ||
    conflicts(htf.weekly, htf.h4) ||
    conflicts(htf.daily, htf.h4)

  if (conflict) {
    warnings.push("Weekly / Daily / H4 bias conflict — HTF alignment missing.")
    return { points: 0, maxPoints, reasons, warnings, passed: false, aligned: false }
  }

  const dominant = dominantHtfBias(htf)
  if (!dominant) {
    warnings.push("No clear HTF directional permission across W/D/H4.")
    return { points: 0, maxPoints, reasons, warnings, passed: false, aligned: false }
  }

  const layers = [
    { label: "Weekly", bias: htf.weekly },
    { label: "Daily", bias: htf.daily },
    { label: "H4", bias: htf.h4 },
  ]

  let alignedCount = 0
  for (const layer of layers) {
    if (layer.bias === dominant || layer.bias === "neutral") {
      alignedCount += 1
      if (layer.bias === dominant) {
        reasons.push(`${layer.label} aligns ${dominant}.`)
      }
    }
  }

  points += Math.round((alignedCount / 3) * maxPoints * 0.75)

  if (!tradeAlignsWithBias(htf.tradeDirection, dominant)) {
    warnings.push(`Trade direction conflicts with dominant HTF bias (${dominant}).`)
    points = Math.round(points * 0.4)
  } else {
    reasons.push(`Trade direction aligns with HTF ${dominant} permission.`)
    points = Math.min(maxPoints, points + Math.round(maxPoints * 0.25))
  }

  const aligned = dominant !== null && !conflict && tradeAlignsWithBias(htf.tradeDirection, dominant)

  return {
    points: Math.min(maxPoints, points),
    maxPoints,
    reasons,
    warnings,
    passed: aligned,
    aligned,
  }
}

/** AOI validation — max 20 pts */
export function evaluateAoiValidation(input: VyronisTradeInput): VyronisComponentResult {
  const maxPoints = VYRONIS_SCORE_WEIGHTS.aoiQuality
  const { aoi } = input
  const reasons: string[] = []
  const warnings: string[] = []
  let points = 0

  if (!aoi.reached) {
    warnings.push("Price has not reached the planned AOI — no Vyronis entry.")
    return { points: 0, maxPoints, reasons, warnings, passed: false }
  }

  points += Math.round(maxPoints * 0.45)
  reasons.push("AOI reached — location edge present.")

  const quality = aoi.qualityScore ?? 70
  if (quality >= 85) {
    points += Math.round(maxPoints * 0.35)
    reasons.push(`High AOI quality (${quality}/100).`)
  } else if (quality >= 65) {
    points += Math.round(maxPoints * 0.2)
    reasons.push(`Acceptable AOI quality (${quality}/100).`)
  } else {
    warnings.push(`Weak AOI quality (${quality}/100) — confluence is thin.`)
    points += Math.round(maxPoints * 0.1)
  }

  if (aoi.invalidationClear === false) {
    warnings.push("Invalidation level unclear — AOI quality reduced.")
    points = Math.round(points * 0.7)
  } else {
    points += Math.round(maxPoints * 0.2)
    reasons.push("Invalidation is defined for the AOI plan.")
  }

  return {
    points: Math.min(maxPoints, points),
    maxPoints,
    reasons,
    warnings,
    passed: aoi.reached && points >= maxPoints * 0.5,
  }
}

/** Liquidity sweep detection — folded into structure scoring context */
export function evaluateLiquiditySweep(input: VyronisTradeInput): VyronisComponentResult {
  const maxPoints = 5
  const { liquidity } = input
  const reasons: string[] = []
  const warnings: string[] = []

  if (!liquidity.sweepDetected) {
    warnings.push("No liquidity sweep detected before entry.")
    return { points: 0, maxPoints, reasons, warnings, passed: false }
  }

  if (liquidity.alignedWithDirection === false) {
    warnings.push("Liquidity sweep conflicts with trade direction.")
    return { points: 1, maxPoints, reasons, warnings, passed: false }
  }

  reasons.push("Liquidity sweep detected in direction of planned trade.")
  return { points: maxPoints, maxPoints, reasons, warnings, passed: true }
}

/** CHoCH / BOS structure shift — max 15 pts (includes liquidity bonus) */
export function evaluateStructureShift(input: VyronisTradeInput): VyronisComponentResult {
  const maxPoints = VYRONIS_SCORE_WEIGHTS.structureShift
  const { structure } = input
  const liquidity = evaluateLiquiditySweep(input)
  const reasons = [...liquidity.reasons]
  const warnings = [...liquidity.warnings]
  let points = 0

  if (structure.shift === "none") {
    warnings.push("No CHoCH or BOS confirmation logged.")
    points += liquidity.points
    return {
      points: Math.min(maxPoints, Math.round(points * 0.35)),
      maxPoints,
      reasons,
      warnings,
      passed: false,
    }
  }

  const label = structure.shift === "choch" ? "CHoCH" : "BOS"
  if (structure.alignedWithDirection === false) {
    warnings.push(`${label} present but conflicts with trade direction.`)
    points += Math.round(maxPoints * 0.25)
  } else {
    reasons.push(`${label} confirms structure shift in trade direction.`)
    points += Math.round(maxPoints * 0.65)
  }

  points += Math.min(liquidity.points, Math.round(maxPoints * 0.35))

  return {
    points: Math.min(maxPoints, points),
    maxPoints,
    reasons,
    warnings,
    passed: structure.alignedWithDirection !== false,
  }
}

/** Engulfing confirmation candle — max 10 pts */
export function evaluateEngulfingConfirmation(input: VyronisTradeInput): VyronisComponentResult {
  const maxPoints = VYRONIS_SCORE_WEIGHTS.confirmationCandle
  const { confirmation } = input
  const reasons: string[] = []
  const warnings: string[] = []
  let points = 0

  if (confirmation.engulfing === "none") {
    warnings.push("No engulfing confirmation candle.")
    if ((confirmation.additionalSignals?.length ?? 0) > 0) {
      points += Math.round(maxPoints * 0.4)
      reasons.push(`Alternate confirmation: ${confirmation.additionalSignals!.join(", ")}.`)
    }
    return { points, maxPoints, reasons, warnings, passed: points >= maxPoints * 0.5 }
  }

  if (confirmation.alignedWithDirection === false) {
    warnings.push("Engulfing candle conflicts with trade direction.")
    points += Math.round(maxPoints * 0.25)
  } else {
    reasons.push(`${confirmation.engulfing} engulfing confirms entry bias.`)
    points += Math.round(maxPoints * 0.75)
  }

  const extras = confirmation.additionalSignals?.length ?? 0
  if (extras > 0) {
    points += Math.min(Math.round(maxPoints * 0.25), extras * 2)
    reasons.push(`Additional confirmation signals (${extras}).`)
  }

  return {
    points: Math.min(maxPoints, points),
    maxPoints,
    reasons,
    warnings,
    passed: confirmation.alignedWithDirection !== false,
  }
}

/** Session filter — max 10 pts */
export function evaluateSessionFilter(input: VyronisTradeInput): VyronisComponentResult {
  const maxPoints = VYRONIS_SCORE_WEIGHTS.sessionTiming
  const { session } = input
  const reasons: string[] = []
  const warnings: string[] = []
  let points = 0

  const favorableSessions = new Set(["london", "new_york", "london_ny_overlap"])

  if (session.session === "unknown") {
    warnings.push("Session not recorded — timing edge unknown.")
    points += Math.round(maxPoints * 0.3)
  } else if (session.session === "off_hours") {
    warnings.push("Off-hours session — liquidity and spread risk elevated.")
    points += Math.round(maxPoints * 0.2)
  } else if (favorableSessions.has(session.session)) {
    points += Math.round(maxPoints * 0.65)
    reasons.push(`${session.session.replace("_", " ")} session supports execution.`)
  } else if (session.session === "asia") {
    points += Math.round(maxPoints * 0.45)
    reasons.push("Asia session — valid for JPY/AUD/NZD plans with reduced size.")
  }

  if (session.favorable === true) {
    points += Math.round(maxPoints * 0.35)
    reasons.push("Session matches pair / weekly plan focus.")
  } else if (session.favorable === false) {
    warnings.push("Session unfavorable for this pair plan.")
    points = Math.round(points * 0.6)
  } else if (points > 0) {
    points += Math.round(maxPoints * 0.15)
  }

  return {
    points: Math.min(maxPoints, points),
    maxPoints,
    reasons,
    warnings,
    passed: points >= maxPoints * 0.5,
  }
}

/** RR validation — max 10 pts */
export function evaluateRrValidation(input: VyronisTradeInput): VyronisComponentResult {
  const maxPoints = VYRONIS_SCORE_WEIGHTS.rrQuality
  const { risk } = input
  const minRr = risk.minimumRr ?? VYRONIS_DOCTRINE.minimumRr
  const reasons: string[] = []
  const warnings: string[] = []
  let points = 0

  const rr = risk.riskReward
  if (rr == null) {
    warnings.push("Risk-reward not provided — cannot validate Vyronis RR rule.")
    return { points: 0, maxPoints, reasons, warnings, passed: false }
  }

  if (rr >= 3) {
    points = maxPoints
    reasons.push(`Excellent R:R 1:${rr.toFixed(1)}.`)
  } else if (rr >= minRr) {
    points = Math.round(maxPoints * 0.85)
    reasons.push(`R:R 1:${rr.toFixed(1)} meets Vyronis minimum (${minRr}).`)
  } else if (rr >= 1.5) {
    points = Math.round(maxPoints * 0.45)
    warnings.push(`R:R 1:${rr.toFixed(1)} below Vyronis minimum (${minRr}).`)
  } else {
    points = Math.round(maxPoints * 0.15)
    warnings.push(`Low R:R 1:${rr.toFixed(1)} — poor asymmetry.`)
  }

  const riskPct = risk.riskPercent
  const maxRisk = risk.maxRiskPercent
  if (riskPct != null && maxRisk != null) {
    if (riskPct <= maxRisk) {
      points = Math.min(maxPoints, points + 1)
      reasons.push(`Risk ${riskPct}% within ${maxRisk}% cap.`)
    } else {
      warnings.push(`Risk ${riskPct}% exceeds ${maxRisk}% cap.`)
      points = Math.round(points * 0.5)
    }
  }

  return {
    points: Math.min(maxPoints, points),
    maxPoints,
    reasons,
    warnings,
    passed: rr >= minRr,
  }
}

/** News proximity filter — warnings only; reduces session/execution context */
export function evaluateNewsProximity(input: VyronisTradeInput): VyronisComponentResult {
  const maxPoints = 0
  const { news } = input
  const reasons: string[] = []
  const warnings: string[] = []

  if (!news.majorNewsProximity) {
    reasons.push("No major news proximity flag — calendar risk clear.")
    return { points: 0, maxPoints, reasons, warnings, passed: true }
  }

  const label = news.eventLabel ?? "Major event"
  const mins = news.minutesToEvent
  warnings.push(
    mins != null
      ? `${label} in ~${mins} min — Vyronis recommends waiting past news.`
      : `${label} nearby — elevated slippage and invalidation risk.`,
  )

  return { points: 0, maxPoints, reasons, warnings, passed: false }
}

function applyNewsPenalty(
  session: VyronisComponentResult,
  news: VyronisComponentResult,
): VyronisComponentResult {
  if (news.passed) return session
  return {
    ...session,
    points: Math.round(session.points * 0.5),
    warnings: [...session.warnings, ...news.warnings],
    passed: false,
  }
}

/** Master Vyronis evaluation — returns standardized AI object */
export function evaluateVyronisCore(input: VyronisTradeInput): VyronisEvaluation {
  const htf = evaluateHtfAlignment(input.htf)
  const aoi = evaluateAoiValidation(input)
  const structure = evaluateStructureShift(input)
  const confirmation = evaluateEngulfingConfirmation(input)
  const news = evaluateNewsProximity(input)
  const session = applyNewsPenalty(evaluateSessionFilter(input), news)
  const rr = evaluateRrValidation(input)
  const emotion = scoreEmotionalDisciplineComponent(input)

  const components: VyronisScoreComponents = {
    htfAlignment: htf,
    aoiQuality: aoi,
    structureShift: structure,
    confirmationCandle: confirmation,
    sessionTiming: session,
    rrQuality: rr,
    emotionalDiscipline: emotion.emotionalDiscipline,
    emotionGlobalPenalty: emotion.emotionGlobalPenalty,
    htfAligned: htf.aligned,
    emotionStable: emotion.emotionStable,
  }

  return buildVyronisEvaluation(input, components)
}

/** Partial evaluation for agent debate / similarity hooks */
export function evaluateVyronisComponents(input: VyronisTradeInput) {
  return {
    htf: evaluateHtfAlignment(input.htf),
    aoi: evaluateAoiValidation(input),
    liquidity: evaluateLiquiditySweep(input),
    structure: evaluateStructureShift(input),
    confirmation: evaluateEngulfingConfirmation(input),
    session: evaluateSessionFilter(input),
    news: evaluateNewsProximity(input),
    rr: evaluateRrValidation(input),
    emotion: scoreEmotionalDisciplineComponent(input),
  }
}
