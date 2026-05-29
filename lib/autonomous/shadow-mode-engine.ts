import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import { detectTraderPatterns } from "@/lib/intelligence/pattern-intelligence-engine"
import { effectiveEmotionalRisk } from "@/lib/intelligence/session-recovery-engine"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import type { ShadowAssessment, ShadowRiskLevel } from "@/lib/autonomous/types"

const IMPULSIVE = new Set(["fomo", "revenge", "euphoric", "anxious", "tilted", "impulsive", "frustrated"])

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function riskLevel(score: number): ShadowRiskLevel {
  if (score >= 75) return "critical"
  if (score >= 55) return "elevated"
  if (score >= 35) return "moderate"
  return "low"
}

/**
 * Shadow Mode — passive pre-trade risk observer.
 * Does not block trades; surfaces emotional/discipline drift before execution.
 */
export function evaluateShadowMode(input: {
  context: FullTraderContext
  plannedContext?: PreTradePlannedContext | null
}): ShadowAssessment {
  const { context, plannedContext } = input
  const flags: string[] = []
  const patterns = detectTraderPatterns(context)

  let emotionalRisk = 28
  let disciplineConfidence = 72
  let executionQuality = 62
  let overtradingProb = 15
  let revengeSignal = 10
  let impulsiveLikelihood = 18
  let disciplineDrift = 12

  const emotion = String(plannedContext?.emotion || "").toLowerCase()
  const plannedEmotion = emotion || context.emotionalState.dominantEmotion?.toLowerCase() || ""

  if (IMPULSIVE.has(plannedEmotion)) {
    emotionalRisk += 28
    impulsiveLikelihood += 32
    flags.push(`Current session emotion reads ${plannedEmotion} — active instability`)
  }

  const recovery = context.sessionRecovery
  const historicalOnly =
    recovery?.carryoverMode === "historical_caution" &&
    recovery.sessionGuardMode === "soft_caution"

  if (context.emotionalState.trend === "volatile") {
    emotionalRisk += historicalOnly ? 10 : 22
    disciplineDrift += historicalOnly ? 8 : 20
    flags.push(
      historicalOnly
        ? "Prior-session volatility noted — decay applied; session not yet confirmed"
        : "Emotional volatility in recent journal",
    )
  } else if (context.emotionalState.trend === "elevated") {
    emotionalRisk += historicalOnly ? 6 : 12
    disciplineDrift += historicalOnly ? 4 : 10
  }

  if (context.emotionalState.impulsiveCount >= 2) {
    impulsiveLikelihood += historicalOnly ? 12 : 24
    emotionalRisk += historicalOnly ? 6 : 14
  }

  const maxTrades = context.settings.max_trades_per_day
  const todayCount = context.memory.snapshot.todayTradeCount
  if (todayCount >= maxTrades) {
    overtradingProb += 45
    disciplineConfidence -= 25
    disciplineDrift += 30
    flags.push("Daily trade limit already reached")
  } else if (todayCount >= maxTrades - 1) {
    overtradingProb += 28
    disciplineDrift += 15
  }

  const recentLosses = context.recentTrades.slice(0, 3).filter((t) => t.result === "LOSS").length
  if (recentLosses >= 2) {
    revengeSignal += 35
    emotionalRisk += 18
    flags.push("Back-to-back losses — revenge risk elevated")
  }

  if (context.risk.todayLossPercent >= context.settings.daily_drawdown_limit * 0.7) {
    emotionalRisk += 20
    disciplineConfidence -= 18
    disciplineDrift += 22
    flags.push("Near daily drawdown limit")
  }

  if (context.memory.primaryLeak.status === "active") {
    disciplineDrift += 18
    disciplineConfidence -= 12
    flags.push(context.memory.primaryLeak.headline)
  }

  for (const p of patterns) {
    if (p.id === "overtrading") overtradingProb += 20
    if (p.id === "emotional_tilt") emotionalRisk += 15
    if (p.id === "fomo_entries") impulsiveLikelihood += 18
    if (p.id === "continuation_bias" && p.severity === "warning") {
      impulsiveLikelihood += 12
      flags.push("Continuation bias pattern active")
    }
  }

  const failedRules = context.dailyRules.filter((r) => !r.checked).length
  if (failedRules >= 2) {
    disciplineDrift += failedRules * 8
    disciplineConfidence -= failedRules * 6
  }

  if (plannedContext?.setup?.includes("A+")) executionQuality += 12
  if (context.memory.topPatterns.some((p) => p.severity === "positive")) {
    executionQuality += 8
  }

  emotionalRisk = clamp(emotionalRisk)
  if (recovery) {
    emotionalRisk = effectiveEmotionalRisk(context, emotionalRisk)
  }
  disciplineConfidence = clamp(disciplineConfidence)
  executionQuality = clamp(executionQuality)
  overtradingProb = clamp(overtradingProb)
  revengeSignal = clamp(revengeSignal)
  impulsiveLikelihood = clamp(impulsiveLikelihood)
  disciplineDrift = clamp(disciplineDrift)

  const composite = clamp(
    emotionalRisk * 0.3 +
      (100 - disciplineConfidence) * 0.25 +
      overtradingProb * 0.2 +
      revengeSignal * 0.15 +
      impulsiveLikelihood * 0.1,
  )

  const overallRiskLevel = riskLevel(composite)
  const shouldPause =
    overallRiskLevel === "critical" ||
    emotionalRisk >= 78 ||
    (recovery?.sessionGuardMode === "aggressive_protect" && emotionalRisk >= 65)

  let proactiveMessage = "Shadow read: conditions look manageable — stay with your plan."
  if (shouldPause) {
    proactiveMessage =
      "I'd pause here. Emotional and discipline drift are high — step back before this trade."
  } else if (overallRiskLevel === "elevated") {
    proactiveMessage =
      "Heads-up: elevated risk. Size down, wait for clean confirmation, and check emotion before entry."
  } else if (recovery?.sessionGuardMode === "soft_caution") {
    proactiveMessage =
      "Prior sessions warrant caution, but today has not confirmed instability — trade smaller if you engage."
  } else if (revengeSignal >= 40) {
    proactiveMessage =
      "Recent losses are in the room — make sure this trade is plan-driven, not reaction."
  } else if (overtradingProb >= 40) {
    proactiveMessage =
      "You're near your daily trade ceiling — quality over quantity from here."
  }

  return {
    emotionalRiskScore: emotionalRisk,
    disciplineConfidence,
    executionQualityPrediction: executionQuality,
    overtradingProbability: overtradingProb,
    revengeTradingSignal: revengeSignal,
    impulsiveEntryLikelihood: impulsiveLikelihood,
    disciplineDrift,
    overallRiskLevel,
    flags: [...new Set(flags)].slice(0, 5),
    proactiveMessage,
    shouldPause,
  }
}
