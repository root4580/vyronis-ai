import { detectTraderPatterns } from "@/lib/intelligence/pattern-intelligence-engine"
import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type { TraderStateTimelineSnapshot } from "@/lib/intelligence/trader-state-timeline-engine"

export type EmotionalSignalId =
  | "emotional_drift"
  | "revenge_behavior"
  | "hesitation"
  | "forced_trade"
  | "overconfidence"
  | "quality_patience"
  | "execution_discipline"
  | "evolution_positive"
  | "evolution_negative"

export type EmotionalSignal = {
  id: EmotionalSignalId
  active: boolean
  strength: number
  message: string
}

export type EmotionalIntelligenceSnapshot = {
  signals: EmotionalSignal[]
  activeSignals: EmotionalSignalId[]
  headline: string
  narrative: string
  /** 0–100 process alignment (higher = healthier trader state) */
  processHealthScore: number
  /** 0–100 risk of impulsive execution */
  impulsiveRiskScore: number
  /** Suggested companion tone without user stating mood */
  inferredTone: "calm" | "protective" | "reflective" | "analytical"
}

const IMPULSIVE = new Set([
  "fomo",
  "revenge",
  "euphoric",
  "anxious",
  "tilted",
  "impulsive",
  "frustrated",
])

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function buildSignal(
  id: EmotionalSignalId,
  active: boolean,
  strength: number,
  message: string,
): EmotionalSignal {
  return { id, active, strength: clamp(strength), message }
}

/**
 * Passive emotional intelligence — infers trader psychology from journal,
 * session monitors, and state timeline without requiring explicit user labels.
 */
export function buildEmotionalIntelligence(input: {
  context: FullTraderContext
  stateTimeline?: TraderStateTimelineSnapshot | null
  recentMessageTone?: string | null
}): EmotionalIntelligenceSnapshot {
  const { context } = input
  const shadow = context.autonomous?.shadow
  const os = context.tradingOs
  const timeline = input.stateTimeline
  const patterns = detectTraderPatterns(context)
  const recent = context.recentTrades.slice(0, 6)
  const emotion = String(
    context.activePlannedContext?.emotion ||
      context.emotionalState.dominantEmotion ||
      "",
  ).toLowerCase()

  const recovery = context.sessionRecovery
  const softHistorical =
    recovery?.sessionGuardMode === "soft_caution" &&
    recovery.carryoverMode === "historical_caution"

  const driftScore = recovery?.adjustedEmotionalRisk ?? os?.liveSession.emotionalDriftScore ?? 0
  const driftRising = timeline?.emotionalDriftTrend === "declining"
  const emotionalDrift =
    recovery?.carryoverMode === "active_instability" ||
    recovery?.phase === "UNSTABLE" ||
    recovery?.phase === "REVENGE_RISK" ||
    (!softHistorical &&
      (context.emotionalState.trend === "volatile" ||
        context.emotionalState.impulsiveCount >= 2)) ||
    driftScore >= (softHistorical ? 62 : 55) ||
    (driftRising && !softHistorical)

  const revengeBehavior =
    recovery?.phase === "REVENGE_RISK" ||
    emotion === "revenge" ||
    (recovery?.carryoverMode !== "historical_caution" &&
      patterns.some((p) => p.id === "reversal_chasing")) ||
    (shadow?.revengeTradingSignal ?? 0) >= (softHistorical ? 55 : 45) ||
    (recovery?.carryoverMode === "active_instability" &&
      recent.filter((t) => /revenge|fomo/i.test(t.emotion || "")).length >= 1) ||
    (!softHistorical &&
      recent.filter((t) => /revenge|fomo/i.test(t.emotion || "")).length >= 2)

  const hesitation =
    input.recentMessageTone === "hesitant" ||
    context.cognitive?.confidenceGraph.hesitationPattern === true ||
    (shadow?.disciplineConfidence != null &&
      shadow.disciplineConfidence < 48 &&
      (context.activePlannedContext?.setup?.length ?? 0) > 0)

  const forcedTrade =
    input.recentMessageTone === "rushed" ||
    input.recentMessageTone === "frustrated" ||
    patterns.some((p) => p.id === "overtrading") ||
    context.memory.snapshot.todayTradeCount >= context.settings.max_trades_per_day - 1

  const recentWins = recent.filter((t) => t.result === "WIN").length
  const winStreak = recent.length >= 3 && recentWins / recent.length >= 0.65
  const overconfidence =
    input.recentMessageTone === "overconfident" ||
    emotion === "euphoric" ||
    winStreak ||
    context.cognitive?.confidenceGraph.fakeConfidence === true

  const rulesChecked = context.dailyRules.filter((r) => r.checked).length
  const rulesTotal = context.dailyRules.length
  const rulesRatio = rulesTotal > 0 ? rulesChecked / rulesTotal : 0.5
  const qualityPatience =
    !emotionalDrift &&
    !forcedTrade &&
    context.memory.snapshot.todayTradeCount <
      Math.max(1, context.settings.max_trades_per_day - 1) &&
    (timeline?.processHealthTrend === "improving" || rulesRatio >= 0.75)

  const executionDiscipline =
    (shadow?.disciplineConfidence ?? 50) >= 68 &&
    (shadow?.executionQualityPrediction ?? 50) >= 62 &&
    recent.filter((t) => t.rule_followed === false).length === 0 &&
    !IMPULSIVE.has(emotion)

  const evolutionPositive =
    timeline?.processHealthTrend === "improving" ||
    (timeline?.strictnessDelta != null && timeline.strictnessDelta < -5)

  const evolutionNegative =
    timeline?.processHealthTrend === "declining" ||
    (timeline?.strictnessDelta != null && timeline.strictnessDelta > 8)

  const signals: EmotionalSignal[] = [
    buildSignal(
      "emotional_drift",
      emotionalDrift,
      emotionalDrift ? Math.max(driftScore, 62) : 15,
      emotionalDrift
        ? softHistorical
          ? recovery?.probabilityNarrative ??
            "Prior sessions suggest caution — current session has not confirmed instability."
          : driftRising
            ? "Emotional drift is rising across recent sessions — pause before adding risk."
            : "Journal shows volatile emotional tone — protect process over setup quality."
        : recovery?.phase === "RECOVERING"
          ? "Recovering — historical stress is fading with time and clean session behavior."
          : "Emotional tone looks relatively stable.",
    ),
    buildSignal(
      "revenge_behavior",
      revengeBehavior,
      revengeBehavior ? 78 : 10,
      revengeBehavior
        ? "Revenge or chase pattern is active in recent behavior."
        : "No active revenge pattern detected.",
    ),
    buildSignal(
      "hesitation",
      hesitation,
      hesitation ? 58 : 12,
      hesitation
        ? "Hesitation pattern — confidence lags setup quality; don't force entries."
        : "No strong hesitation signal.",
    ),
    buildSignal(
      "forced_trade",
      forcedTrade,
      forcedTrade ? 72 : 8,
      forcedTrade
        ? "Session pressure suggests forcing trades — stand down or halve size."
        : "No forced-trade pressure detected.",
    ),
    buildSignal(
      "overconfidence",
      overconfidence,
      overconfidence ? 70 : 10,
      overconfidence
        ? "Overconfidence risk — win streak or inflated certainty vs process quality."
        : "Confidence level looks proportionate.",
    ),
    buildSignal(
      "quality_patience",
      qualityPatience,
      qualityPatience ? 75 : 20,
      qualityPatience
        ? "High-quality patience — selective entries and stable emotional tone."
        : "Patience signal is weak today.",
    ),
    buildSignal(
      "execution_discipline",
      executionDiscipline,
      executionDiscipline ? 80 : 25,
      executionDiscipline
        ? "Execution discipline is strong — rules and process are holding."
        : "Execution discipline needs reinforcement.",
    ),
    buildSignal(
      "evolution_positive",
      evolutionPositive,
      evolutionPositive ? 65 : 15,
      evolutionPositive
        ? "Trader evolution trending positive — stricter self-guardrails easing with better process."
        : "No clear positive evolution shift yet.",
    ),
    buildSignal(
      "evolution_negative",
      evolutionNegative,
      evolutionNegative ? 68 : 12,
      evolutionNegative
        ? "Trader evolution trending negative — protective mode warranted."
        : "No negative evolution spiral detected.",
    ),
  ]

  const activeSignals = signals.filter((s) => s.active).map((s) => s.id)

  let impulsiveRiskScore = 25
  if (emotionalDrift) impulsiveRiskScore += 28
  if (revengeBehavior) impulsiveRiskScore += 30
  if (forcedTrade) impulsiveRiskScore += 22
  if (overconfidence) impulsiveRiskScore += 18
  impulsiveRiskScore = clamp(impulsiveRiskScore)

  let processHealthScore = 55
  if (executionDiscipline) processHealthScore += 22
  if (qualityPatience) processHealthScore += 18
  if (evolutionPositive) processHealthScore += 12
  if (emotionalDrift) processHealthScore -= 20
  if (revengeBehavior) processHealthScore -= 25
  if (evolutionNegative) processHealthScore -= 15
  processHealthScore = clamp(processHealthScore)

  const topRisk = signals
    .filter((s) => s.active && s.strength >= 55)
    .sort((a, b) => b.strength - a.strength)[0]

  const topStrength = signals
    .filter(
      (s) =>
        s.active &&
        (s.id === "quality_patience" || s.id === "execution_discipline"),
    )
    .sort((a, b) => b.strength - a.strength)[0]

  const headline = recovery?.cautionSummary
    ? recovery.cautionSummary
    : topRisk
      ? topRisk.message.split("—")[0].trim()
      : topStrength
        ? topStrength.message.split("—")[0].trim()
        : "Process-aligned — standard coaching."

  const narrative = [
    topRisk ? `Watch: ${topRisk.message}` : null,
    topStrength && !topRisk ? `Strength: ${topStrength.message}` : null,
    activeSignals.length > 2
      ? `Multiple signals: ${activeSignals.slice(0, 3).join(", ").replace(/_/g, " ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" ")

  const inferredTone: EmotionalIntelligenceSnapshot["inferredTone"] =
    revengeBehavior || emotionalDrift || forcedTrade
      ? "protective"
      : hesitation || evolutionNegative
        ? "reflective"
        : overconfidence
          ? "analytical"
          : "calm"

  return {
    signals,
    activeSignals,
    headline,
    narrative,
    processHealthScore,
    impulsiveRiskScore,
    inferredTone,
  }
}

/** Top signal lines for LLM / verdict (max 2) */
export function pickEmotionalIntelligenceLines(
  snapshot: EmotionalIntelligenceSnapshot,
  max = 2,
): string[] {
  return snapshot.signals
    .filter((s) => s.active && s.strength >= 50)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, max)
    .map((s) => s.message)
}
