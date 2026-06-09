import type { CommandCenterVisionAnalysis } from "@/lib/intelligence/command-center-vision-engine"
import type { ConfidenceFactor } from "@/lib/intelligence/weighted-confidence-engine"
import { detectTraderPatterns } from "@/lib/intelligence/pattern-intelligence-engine"
import { filterFreshWarnings } from "@/lib/intelligence/conversation-continuity"
import { buildComparativeMemoryLine } from "@/lib/intelligence/comparative-memory-engine"
import type {
  FullTraderContext,
  TradeDecisionRecommendation,
} from "@/lib/intelligence/intelligence-types"
import { applyCalibrationToStrictness } from "@/lib/intelligence/verdict-calibration-engine"
import {
  pickEmotionalIntelligenceLines,
  type EmotionalSignalId,
} from "@/lib/intelligence/emotional-intelligence-engine"
import {
  buildCoachHeadline,
  buildConfidenceExplanation,
  buildHistoricalPatternMemory,
  buildWhatWouldMakeTradable,
  dedupeReasonLines,
  deriveBestAction,
  deriveExecutionRiskLevel,
  deriveFinalActionLabel,
  scoreToTechnicalLabel,
  scoreToTraderLabel,
  softenBlockerMessage,
} from "@/lib/intelligence/session-guard-copy"
import {
  effectiveEmotionalRisk,
  emotionalInstabilityBlockerMessage,
  shouldTreatEmotionalBlockerAsCritical,
} from "@/lib/intelligence/session-recovery-engine"
import type { EmotionalConfidenceLevel } from "@/lib/intelligence/session-recovery-engine"
import { countTradesThisWeek } from "@/lib/user-settings"

export type BlockerPriority = "critical" | "elevated"

export type VerdictBlocker = {
  id: string
  message: string
  priority: BlockerPriority
}

export type VerdictFactorLine = {
  label: string
  score: number
  note: string
}

export type VerdictReasoning = {
  /** Final combined verdict (same as legacy `verdict`) */
  verdict: TradeDecisionRecommendation
  score: number
  technicalSetupVerdict: TradeDecisionRecommendation
  technicalSetupScore: number
  traderStateVerdict: TradeDecisionRecommendation
  traderStateScore: number
  riskConditionsVerdict: TradeDecisionRecommendation
  riskConditionsScore: number
  psychologyOverride: boolean
  overrideReasons: string[]
  finalDecisionExplanation: string
  psychologyClarification: string | null
  traderStateMetrics: {
    emotionalRisk: number | null
    disciplineConfidence: number | null
    executionQuality: number | null
  }
  structuralStrength: number
  positiveFactors: VerdictFactorLine[]
  negativeFactors: VerdictFactorLine[]
  criticalBlockers: VerdictBlocker[]
  elevatedBlockers: VerdictBlocker[]
  technicalBlockers: VerdictBlocker[]
  traderStateBlockers: VerdictBlocker[]
  riskBlockers: VerdictBlocker[]
  dominantDecidingFactor: string
  whyNotTake: string[]
  reasoningSummary: string
  marketEnvironmentNote: string | null
  humanSignals: string[]
  /** Human-readable layer labels for Session Guard UI */
  technicalLayerLabel: ReturnType<typeof scoreToTechnicalLabel>
  traderLayerLabel: ReturnType<typeof scoreToTraderLabel>
  finalActionLabel: ReturnType<typeof deriveFinalActionLabel>
  executionRiskLevel: ReturnType<typeof deriveExecutionRiskLevel>
  bestAction: string
  coachHeadline: string
  confidenceExplanation: string | null
  historicalPatternMemory: string | null
  whatWouldMakeTradable: string[]
  emotionalConfidence?: EmotionalConfidenceLevel | null
  emotionalConfidenceReasons?: string[]
  sessionRecoveryPhase?: string | null
}

const STRONG_THRESHOLD = 68
const WEAK_THRESHOLD = 50
const BULLISH_MAJORITY_MIN = 5

const TECHNICAL_FACTOR_KEYS = new Set(["htf", "confirmation", "volatility", "counterTrend", "rr"])
const TRADER_FACTOR_KEYS = new Set(["emotional", "recentPerformance", "session"])

const TECHNICAL_BLOCKER_IDS = new Set([
  "htf_ltf_conflict",
  "countertrend",
  "late_entry",
  "weak_confirmation",
  "invalid_rr",
  "low_liquidity",
  "news_volatility",
])

const TRADER_BLOCKER_IDS = new Set([
  "emotional_instability",
  "revenge_behavior",
  "losing_pattern_similarity",
])

const RISK_BLOCKER_IDS = new Set([
  "daily_trade_limit",
  "drawdown_limit",
  "overtrading",
  "market_expanded_vol",
  "market_choppy",
  "news_volatility",
  "low_liquidity",
  "poor_session",
])

const IMPULSIVE = new Set(["fomo", "revenge", "euphoric", "anxious", "tilted", "impulsive", "frustrated"])

const PSYCHOLOGY_CLARIFICATION =
  "The chart is not the main problem — your process state is. A workable setup can still become a poor trade when execution is compromised."

function isHistoryOnlyPsychologicalRead(context: FullTraderContext): boolean {
  const hasTodayMood = Boolean(context.activePlannedContext?.emotion?.trim())
  return countTradesThisWeek(context.recentTrades) === 0 && !hasTodayMood
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function collectBlockers(input: {
  context: FullTraderContext
  chartVision?: CommandCenterVisionAnalysis | null
  factors: ConfidenceFactor[]
  mentionedWarningIds?: Set<string>
}): VerdictBlocker[] {
  const { context, chartVision, factors } = input
  const blockers: VerdictBlocker[] = []
  const patterns = detectTraderPatterns(context)
  const freshWarnings = filterFreshWarnings(
    context.memory.warnings,
    input.mentionedWarningIds ?? new Set(),
  )

  const plannedEmotion = String(
    context.activePlannedContext?.emotion || context.emotionalState.dominantEmotion || "",
  ).toLowerCase()

  if (context.memory.snapshot.todayTradeCount >= context.settings.max_trades_per_day) {
    blockers.push({
      id: "daily_trade_limit",
      message: `You already exceeded max daily trades (${context.settings.max_trades_per_day}).`,
      priority: "critical",
    })
  }

  const historyOnlyPsychRead = isHistoryOnlyPsychologicalRead(context)
  const emotionalCritical = shouldTreatEmotionalBlockerAsCritical(context)
  const emotionalElevated =
    !emotionalCritical &&
    (context.emotionalState.trend === "elevated" ||
      context.emotionalState.impulsiveCount >= 1 ||
      context.sessionRecovery?.carryoverMode === "historical_caution")

  if (
    !historyOnlyPsychRead &&
    (emotionalCritical || IMPULSIVE.has(plannedEmotion))
  ) {
    blockers.push({
      id: "emotional_instability",
      message: softenBlockerMessage(
        "emotional_instability",
        emotionalInstabilityBlockerMessage(context),
        plannedEmotion,
      ),
      priority: emotionalCritical ? "critical" : "elevated",
    })
  } else if (
    !historyOnlyPsychRead &&
    emotionalElevated &&
    context.sessionRecovery?.sessionGuardMode === "soft_caution"
  ) {
    blockers.push({
      id: "emotional_instability",
      message: emotionalInstabilityBlockerMessage(context),
      priority: "elevated",
    })
  }

  if (context.risk.todayLossPercent >= context.settings.daily_drawdown_limit * 0.85) {
    blockers.push({
      id: "drawdown_limit",
      message: `Near daily drawdown limit (${context.risk.todayLossPercent.toFixed(1)}% used).`,
      priority: "critical",
    })
  }

  for (const w of freshWarnings.filter((x) => x.severity === "critical")) {
    blockers.push({
      id: `warning_${w.id}`,
      message: w.message,
      priority: "critical",
    })
  }

  const bundle = chartVision?.bundle
  if (bundle?.htfAlignment === "conflict" || bundle?.ltfConfirmsHtf === false) {
    blockers.push({
      id: "htf_ltf_conflict",
      message:
        bundle.htfAlignment === "conflict"
          ? "Higher timeframes conflict — HTF/LTF alignment is not tradeable."
          : "Lower timeframe momentum is weakening despite HTF alignment.",
      priority: "critical",
    })
  }

  if (chartVision?.vision?.metrics.countertrend) {
    blockers.push({
      id: "countertrend",
      message: "Counter-trend entry against dominant structure.",
      priority: "critical",
    })
  }

  if (bundle?.entryTiming === "late") {
    blockers.push({
      id: "late_entry",
      message: "Entry timing is late — chase risk overrides confirmation quality.",
      priority: "critical",
    })
  }

  const revengeActive =
    context.sessionRecovery?.phase === "REVENGE_RISK" ||
    plannedEmotion === "revenge" ||
    (context.sessionRecovery?.carryoverMode === "active_instability" &&
      patterns.some((p) => p.id === "reversal_chasing"))

  if (revengeActive) {
    blockers.push({
      id: "revenge_behavior",
      message:
        context.sessionRecovery?.sessionGuardMode === "soft_caution"
          ? "Prior revenge-style losses noted — stay plan-driven if you trade."
          : "Revenge or counter-trend behavior is active in this session.",
      priority:
        context.sessionRecovery?.sessionGuardMode === "aggressive_protect"
          ? "critical"
          : "elevated",
    })
  }

  const comparative = buildComparativeMemoryLine({ context, chartVision })
  if (comparative && /loss|emotional|impulsive|revenge/i.test(comparative)) {
    blockers.push({
      id: "losing_pattern_similarity",
      message: comparative,
      priority: "critical",
    })
  }

  const autonomous = context.autonomous
  if (autonomous?.session?.marketContext === "low_liquidity") {
    blockers.push({
      id: "low_liquidity",
      message: "Low-liquidity session — unreliable execution environment.",
      priority: "elevated",
    })
  }
  if (autonomous?.session?.marketContext === "news_volatility") {
    blockers.push({
      id: "news_volatility",
      message: "Elevated news volatility — size down or stand aside.",
      priority: "elevated",
    })
  }

  const rrFactor = factors.find((f) => f.key === "rr")
  if (rrFactor && rrFactor.score < 42) {
    blockers.push({
      id: "invalid_rr",
      message: "R:R structure is weak after planned levels (spread/slippage not forgiving).",
      priority: "elevated",
    })
  }

  const confirmFactor = factors.find((f) => f.key === "confirmation")
  if (confirmFactor && confirmFactor.score < 48 && confirmFactor.score >= 35) {
    blockers.push({
      id: "weak_confirmation",
      message: "Confirmation quality is acceptable but not strong enough to override risk flags.",
      priority: "elevated",
    })
  }

  const sessionFactor = factors.find((f) => f.key === "session")
  if (sessionFactor && sessionFactor.score < 45) {
    blockers.push({
      id: "poor_session",
      message: `Session conditions are weak for you (${sessionFactor.note}).`,
      priority: "elevated",
    })
  }

  if (patterns.some((p) => p.id === "overtrading")) {
    blockers.push({
      id: "overtrading",
      message: "Overtrading pattern detected in recent journal.",
      priority: "elevated",
    })
  }

  const ei = context.emotionalIntelligence
  if (ei) {
    const eiBlockers: Record<
      EmotionalSignalId,
      { id: string; priority: BlockerPriority; prefix: string }
    > = {
      emotional_drift: {
        id: "emotional_instability",
        priority: "critical",
        prefix: "Emotional drift detected",
      },
      revenge_behavior: {
        id: "revenge_behavior",
        priority: "critical",
        prefix: "Revenge behavior pattern",
      },
      hesitation: {
        id: "weak_confirmation",
        priority: "elevated",
        prefix: "Hesitation vs setup quality",
      },
      forced_trade: {
        id: "overtrading",
        priority: "critical",
        prefix: "Forced-trade pressure",
      },
      overconfidence: {
        id: "warning_overconfidence",
        priority: "elevated",
        prefix: "Overconfidence risk",
      },
      quality_patience: { id: "_skip", priority: "elevated", prefix: "" },
      execution_discipline: { id: "_skip", priority: "elevated", prefix: "" },
      evolution_positive: { id: "_skip", priority: "elevated", prefix: "" },
      evolution_negative: {
        id: "warning_evolution",
        priority: "elevated",
        prefix: "Trader evolution declining",
      },
    }
    for (const signal of ei.signals) {
      if (!signal.active || signal.strength < 58) continue
      const map = eiBlockers[signal.id]
      if (!map || map.id === "_skip") continue
      if (blockers.some((b) => b.id === map.id)) continue
      blockers.push({
        id: map.id,
        message: `${map.prefix} — ${signal.message}`,
        priority: map.priority,
      })
    }
  }

  if (context.cognitive?.confidenceGraph.fakeConfidence) {
    blockers.push({
      id: "warning_fake_confidence",
      message: "Perceived confidence exceeds trade quality — size down or wait.",
      priority: "elevated",
    })
  }
  if (context.cognitive?.confidenceGraph.hesitationPattern) {
    blockers.push({
      id: "warning_hesitation",
      message: "Hesitation pattern — don't force marginal entries.",
      priority: "elevated",
    })
  }

  const seen = new Set<string>()
  return blockers.filter((b) => {
    if (seen.has(b.id)) return false
    seen.add(b.id)
    return true
  })
}

function structuralStrength(factors: ConfidenceFactor[]): number {
  const strong = factors.filter((f) => f.score >= STRONG_THRESHOLD).length
  const weak = factors.filter((f) => f.score < WEAK_THRESHOLD).length
  const avg = factors.reduce((s, f) => s + f.score, 0) / Math.max(factors.length, 1)
  return clamp(avg * 0.5 + strong * 8 - weak * 6)
}

function weightedScoreForKeys(factors: ConfidenceFactor[], keys: Set<string>): number {
  const subset = factors.filter((f) => keys.has(f.key))
  if (subset.length === 0) return 50
  const weightSum = subset.reduce((s, f) => s + f.weight, 0)
  if (weightSum <= 0) return 50
  return clamp(subset.reduce((s, f) => s + f.score * f.weight, 0) / weightSum)
}

function partitionBlockers(blockers: VerdictBlocker[]): {
  technical: VerdictBlocker[]
  trader: VerdictBlocker[]
  risk: VerdictBlocker[]
} {
  const technical: VerdictBlocker[] = []
  const trader: VerdictBlocker[] = []
  const risk: VerdictBlocker[] = []
  for (const b of blockers) {
    if (TECHNICAL_BLOCKER_IDS.has(b.id)) {
      technical.push(b)
    } else if (RISK_BLOCKER_IDS.has(b.id)) {
      risk.push(b)
    } else if (TRADER_BLOCKER_IDS.has(b.id) || b.id.startsWith("warning_")) {
      trader.push(b)
    } else {
      risk.push(b)
    }
  }
  return { technical, trader, risk }
}

function buildRiskConditionsScore(
  factors: ConfidenceFactor[],
  riskBlockers: VerdictBlocker[],
): number {
  let score = weightedScoreForKeys(
    factors,
    new Set([...TECHNICAL_FACTOR_KEYS, "session", "volatility"]),
  )
  const critical = riskBlockers.filter((b) => b.priority === "critical").length
  const elevated = riskBlockers.filter((b) => b.priority === "elevated").length
  score -= critical * 22 + elevated * 10
  return clamp(score)
}

function deriveLayerVerdict(input: {
  score: number
  critical: VerdictBlocker[]
  elevated: VerdictBlocker[]
  mostlyBullish: boolean
}): TradeDecisionRecommendation {
  const { score, critical, elevated, mostlyBullish } = input
  if (critical.length > 0) {
    return mostlyBullish && score >= 52 ? "CAUTION" : "SKIP"
  }
  if (score >= 72) return "TAKE"
  if (score <= 42) return elevated.length >= 2 ? "SKIP" : "CAUTION"
  if (score >= 65) return elevated.length >= 3 ? "CAUTION" : "TAKE"
  return "CAUTION"
}

function worseVerdict(
  a: TradeDecisionRecommendation,
  b: TradeDecisionRecommendation,
): TradeDecisionRecommendation {
  const rank = { TAKE: 0, CAUTION: 1, SKIP: 2 }
  return rank[a] >= rank[b] ? a : b
}

function buildTraderStateScore(
  factors: ConfidenceFactor[],
  context: FullTraderContext,
): { score: number; metrics: VerdictReasoning["traderStateMetrics"] } {
  const base = weightedScoreForKeys(factors, TRADER_FACTOR_KEYS)
  const shadow = context.autonomous?.shadow
  const rawEmotional = shadow?.emotionalRiskScore ?? null
  const metrics = {
    emotionalRisk:
      rawEmotional != null
        ? effectiveEmotionalRisk(context, rawEmotional)
        : context.sessionRecovery?.adjustedEmotionalRisk ?? null,
    disciplineConfidence: shadow?.disciplineConfidence ?? null,
    executionQuality: shadow?.executionQualityPrediction ?? null,
  }

  if (
    metrics.disciplineConfidence != null &&
    metrics.executionQuality != null
  ) {
    const processScore = clamp(
      (metrics.disciplineConfidence + metrics.executionQuality) / 2,
    )
    let blended = clamp(base * 0.35 + processScore * 0.65)
    if (metrics.emotionalRisk != null && metrics.emotionalRisk >= 75) {
      blended = Math.min(blended, 42)
    }
    if (metrics.emotionalRisk != null && metrics.emotionalRisk >= 88) {
      blended = Math.min(blended, 32)
    }
    return { score: blended, metrics }
  }

  return { score: base, metrics }
}

function buildOverrideReasons(input: {
  traderBlockers: VerdictBlocker[]
  riskBlockers: VerdictBlocker[]
  metrics: VerdictReasoning["traderStateMetrics"]
  context: FullTraderContext
}): string[] {
  const reasons: string[] = []
  for (const b of input.traderBlockers) {
    if (/revenge|fomo|emotional|impulsive|tilt/i.test(b.message)) {
      reasons.push(b.message)
    }
  }
  for (const b of input.riskBlockers) {
    if (/overtrad|daily trade|drawdown|limit/i.test(b.message)) {
      reasons.push(b.message)
    }
  }
  const recovery = input.context.sessionRecovery
  if (input.metrics.emotionalRisk != null && input.metrics.emotionalRisk >= 70) {
    reasons.push(
      recovery?.carryoverMode === "historical_caution"
        ? `Historical emotional caution (~${input.metrics.emotionalRisk}/100, decay applied)`
        : `Elevated emotional risk (${input.metrics.emotionalRisk}/100)`,
    )
  } else if (
    input.metrics.emotionalRisk != null &&
    input.metrics.emotionalRisk >= 55 &&
    recovery?.sessionGuardMode === "soft_caution"
  ) {
    reasons.push(recovery.probabilityNarrative)
  }
  if (
    input.metrics.executionQuality != null &&
    input.metrics.executionQuality < 50
  ) {
    reasons.push(`Low execution quality forecast (${input.metrics.executionQuality}/100)`)
  }
  if (
    input.context.emotionalState.trend === "volatile" &&
    recovery?.carryoverMode !== "historical_caution"
  ) {
    reasons.push("Emotional drift in recent journal")
  }
  const comparative = buildComparativeMemoryLine({ context: input.context })
  if (comparative && /loss|emotional|impulsive|revenge/i.test(comparative)) {
    reasons.push(comparative)
  }
  return [...new Set(reasons)].slice(0, 5)
}

function buildPsychologyClarification(
  technicalVerdict: TradeDecisionRecommendation,
  traderVerdict: TradeDecisionRecommendation,
  riskVerdict: TradeDecisionRecommendation,
  metrics: VerdictReasoning["traderStateMetrics"],
  overrideReasons: string[],
): string | null {
  const setupOk =
    technicalVerdict === "TAKE" || technicalVerdict === "CAUTION"
  const humanBad = traderVerdict === "SKIP" || riskVerdict === "SKIP"
  if (!setupOk || !humanBad) return null

  const parts = [PSYCHOLOGY_CLARIFICATION]
  if (overrideReasons.length > 0) {
    parts.push(`Override because: ${overrideReasons.slice(0, 3).join("; ")}.`)
  } else {
    const detail: string[] = []
    if (metrics.emotionalRisk != null) detail.push(`emotional risk ${metrics.emotionalRisk}`)
    if (metrics.disciplineConfidence != null) {
      detail.push(`discipline ${metrics.disciplineConfidence}`)
    }
    if (metrics.executionQuality != null) {
      detail.push(`execution ${metrics.executionQuality}`)
    }
    if (detail.length > 0) parts.push(`Right now: ${detail.join(", ")}.`)
  }
  return parts.join(" ")
}

function buildFinalDecisionExplanation(input: {
  finalVerdict: TradeDecisionRecommendation
  technicalVerdict: TradeDecisionRecommendation
  traderVerdict: TradeDecisionRecommendation
  psychologyOverride: boolean
  technicalLabel: string
  traderLabel: string
  finalAction: string
}): string {
  const { finalVerdict, technicalVerdict, traderVerdict, psychologyOverride, technicalLabel, traderLabel, finalAction } =
    input
  if (psychologyOverride) {
    return `Technical setup: ${technicalLabel} · Trader state: ${traderLabel} → Best action: ${finalAction}. The chart is not the blocker — protect process first.`
  }
  if (finalVerdict === technicalVerdict && finalVerdict === traderVerdict) {
    return `Technical ${technicalLabel} and trader state ${traderLabel} align → ${finalAction}.`
  }
  if (technicalVerdict !== traderVerdict) {
    return `Technical ${technicalLabel} (${technicalVerdict}) vs trader ${traderLabel} (${traderVerdict}) → ${finalAction}.`
  }
  return `Best action: ${finalAction}.`
}

/**
 * Verdict hierarchy:
 * - SKIP only when critical blocker(s) exist AND they override otherwise strong structure.
 * - If metrics are mostly bullish (5+ factors strong), prefer CAUTION over SKIP unless critical blockers.
 * - TAKE when score high, no critical blockers, structural strength solid.
 */
export function resolveVerdictWithReasoning(input: {
  score: number
  factors: ConfidenceFactor[]
  context: FullTraderContext
  chartVision?: CommandCenterVisionAnalysis | null
  mentionedWarningIds?: Set<string>
}): VerdictReasoning {
  const factors = input.factors
  const marketEnv = input.context.cognitive?.marketEnvironment
  const patterns = detectTraderPatterns(input.context)
  const blockers = collectBlockers({
    context: input.context,
    chartVision: input.chartVision,
    factors,
    mentionedWarningIds: input.mentionedWarningIds,
  })

  if (marketEnv && marketEnv.labels.includes("expanding_volatility")) {
    blockers.push({
      id: "market_expanded_vol",
      message: `Market environment: expanding volatility — ${marketEnv.tradingBias}`,
      priority: "elevated",
    })
  }
  if (marketEnv && marketEnv.labels.includes("choppy")) {
    blockers.push({
      id: "market_choppy",
      message: "Market environment: choppy — reduce size or wait.",
      priority: "elevated",
    })
  }

  const criticalBlockers = blockers.filter((b) => b.priority === "critical")
  const elevatedBlockers = blockers.filter((b) => b.priority === "elevated")
  const { technical: technicalBlockers, trader: traderStateBlockers, risk: riskBlockers } =
    partitionBlockers(blockers)
  const techCritical = technicalBlockers.filter((b) => b.priority === "critical")
  const techElevated = technicalBlockers.filter((b) => b.priority === "elevated")
  const traderCritical = traderStateBlockers.filter((b) => b.priority === "critical")
  const traderElevated = traderStateBlockers.filter((b) => b.priority === "elevated")
  const riskCritical = riskBlockers.filter((b) => b.priority === "critical")
  const riskElevated = riskBlockers.filter((b) => b.priority === "elevated")

  const strength = structuralStrength(factors)
  const technicalFactors = factors.filter((f) => TECHNICAL_FACTOR_KEYS.has(f.key))
  const strongTechnicalCount = technicalFactors.filter(
    (f) => f.score >= STRONG_THRESHOLD,
  ).length
  const mostlyBullishTechnical = strongTechnicalCount >= 3

  const technicalSetupScore = weightedScoreForKeys(factors, TECHNICAL_FACTOR_KEYS)
  const { score: traderStateScore, metrics: traderStateMetrics } = buildTraderStateScore(
    factors,
    input.context,
  )

  const technicalSetupVerdict = deriveLayerVerdict({
    score: technicalSetupScore,
    critical: techCritical,
    elevated: techElevated,
    mostlyBullish: mostlyBullishTechnical,
  })
  const traderStateVerdict = deriveLayerVerdict({
    score: traderStateScore,
    critical: traderCritical,
    elevated: traderElevated,
    mostlyBullish: false,
  })

  const riskConditionsScore = buildRiskConditionsScore(factors, riskBlockers)
  const riskConditionsVerdict = deriveLayerVerdict({
    score: riskConditionsScore,
    critical: riskCritical,
    elevated: riskElevated,
    mostlyBullish: false,
  })

  let verdict = worseVerdict(
    worseVerdict(technicalSetupVerdict, traderStateVerdict),
    riskConditionsVerdict,
  )

  const overrideReasons = dedupeReasonLines(
    buildOverrideReasons({
      traderBlockers: [...traderCritical, ...traderElevated],
      riskBlockers: [...riskCritical, ...riskElevated],
      metrics: traderStateMetrics,
      context: input.context,
    }),
  )

  let psychologyOverride =
    (technicalSetupVerdict === "TAKE" || technicalSetupVerdict === "CAUTION") &&
    verdict === "SKIP" &&
    (traderStateVerdict === "SKIP" || riskConditionsVerdict === "SKIP") &&
    (traderCritical.length > 0 || riskCritical.length > 0 || overrideReasons.length > 0)

  if (psychologyOverride) {
    verdict = "SKIP"
  }

  const historyOnlyPsychRead = isHistoryOnlyPsychologicalRead(input.context)
  if (
    historyOnlyPsychRead &&
    verdict === "SKIP" &&
    input.context.sessionRecovery?.carryoverMode === "historical_caution" &&
    !shouldTreatEmotionalBlockerAsCritical(input.context)
  ) {
    verdict = "CAUTION"
    psychologyOverride = false
  }

  let cognitiveStrictness = input.context.cognitive?.state.verdictStrictness ?? 55
  cognitiveStrictness = applyCalibrationToStrictness(
    cognitiveStrictness,
    input.context.verdictCalibration,
  )
  if (cognitiveStrictness >= 75 && verdict === "TAKE") {
    verdict = "CAUTION"
  }
  if (
    cognitiveStrictness >= 82 &&
    verdict !== "SKIP" &&
    traderCritical.length > 0 &&
    !historyOnlyPsychRead
  ) {
    verdict = "SKIP"
  }

  const strongCount = factors.filter((f) => f.score >= STRONG_THRESHOLD).length
  const mostlyBullish = strongCount >= BULLISH_MAJORITY_MIN
  if (mostlyBullish && verdict === "SKIP" && criticalBlockers.length === 0) {
    verdict = "CAUTION"
  }

  const positiveFactors = factors
    .filter((f) => f.score >= STRONG_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .map((f) => ({ label: f.label, score: f.score, note: f.note }))

  const negativeFactors = factors
    .filter((f) => f.score < STRONG_THRESHOLD)
    .sort((a, b) => a.score - b.score)
    .map((f) => ({ label: f.label, score: f.score, note: f.note }))

  const psychologyClarification = buildPsychologyClarification(
    technicalSetupVerdict,
    traderStateVerdict,
    riskConditionsVerdict,
    traderStateMetrics,
    overrideReasons,
  )
  const technicalLayerLabel = scoreToTechnicalLabel(technicalSetupScore)
  const traderLayerLabel = scoreToTraderLabel(traderStateScore)
  const finalActionLabel = deriveFinalActionLabel(verdict)
  const executionRiskLevel = deriveExecutionRiskLevel({
    finalVerdict: verdict,
    traderScore: traderStateScore,
    riskScore: riskConditionsScore,
    criticalCount: criticalBlockers.length,
  })
  const bestAction = deriveBestAction(verdict, executionRiskLevel)
  const confidenceExplanation = buildConfidenceExplanation({
    technicalScore: technicalSetupScore,
    traderScore: traderStateScore,
    metrics: traderStateMetrics,
    psychologyOverride,
    sessionRecovery: input.context.sessionRecovery,
  })
  const historicalPatternMemory = buildHistoricalPatternMemory(input.context, patterns)
  const whatWouldMakeTradable = buildWhatWouldMakeTradable({
    context: input.context,
    technicalBlockers,
    traderBlockers: traderStateBlockers,
    riskBlockers,
    traderScore: traderStateScore,
  })
  const coachHeadline = buildCoachHeadline({
    finalVerdict: verdict,
    technicalLabel: technicalLayerLabel,
    traderLabel: traderLayerLabel,
    psychologyOverride,
  })

  const finalDecisionExplanation = buildFinalDecisionExplanation({
    finalVerdict: verdict,
    technicalVerdict: technicalSetupVerdict,
    traderVerdict: traderStateVerdict,
    psychologyOverride,
    technicalLabel: technicalLayerLabel,
    traderLabel: traderLayerLabel,
    finalAction: finalActionLabel,
  })
  const finalWithRisk = psychologyOverride
    ? `${finalDecisionExplanation} Risk conditions: ${riskConditionsVerdict} (${riskConditionsScore}/100).`
    : riskConditionsVerdict !== technicalSetupVerdict
      ? `${finalDecisionExplanation} Risk: ${riskConditionsVerdict}.`
      : finalDecisionExplanation

  const dominantDecidingFactor = psychologyOverride
    ? overrideReasons[0] ??
      traderCritical[0]?.message ??
      riskCritical[0]?.message ??
      `Trader/risk state overrides aligned technical setup (${technicalSetupVerdict})`
    : criticalBlockers[0]?.message ??
      elevatedBlockers[0]?.message ??
      negativeFactors[0]?.note ??
      positiveFactors[0]?.note ??
      `Weighted score ${input.score}/100`

  const whyNotTakeRaw: string[] = []
  if (verdict !== "TAKE") {
    if (psychologyOverride) {
      whyNotTakeRaw.push(
        `Chart reads ${technicalLayerLabel} (${technicalSetupScore}/100) — process is the limiter, not structure.`,
      )
      whyNotTakeRaw.push(`Trader state ${traderLayerLabel} (${traderStateScore}/100).`)
    }
    for (const r of overrideReasons.slice(0, 3)) {
      whyNotTakeRaw.push(r)
    }
    for (const b of [...traderCritical, ...riskCritical, ...techCritical, ...elevatedBlockers]) {
      if (whyNotTakeRaw.length >= 5) break
      whyNotTakeRaw.push(b.message)
    }
    if (whyNotTakeRaw.length === 0 && negativeFactors.length > 0) {
      for (const f of negativeFactors.slice(0, 2)) {
        whyNotTakeRaw.push(`${f.label} (${f.score}): ${f.note}`)
      }
    }
    if (whyNotTakeRaw.length === 0) {
      whyNotTakeRaw.push(`Composite ${input.score}/100 — wait for cleaner alignment before full size.`)
    }
  }
  const whyNotTake = dedupeReasonLines(whyNotTakeRaw).slice(0, 5)

  let reasoningSummary = `${coachHeadline} Technical ${technicalSetupScore} · Psychology ${traderStateScore} · Risk ${riskConditionsScore} → ${finalActionLabel}.`

  const marketEnvironmentNote = marketEnv
    ? `Market environment: ${marketEnv.labels.filter((l) => l !== "neutral").join(", ") || marketEnv.primary} — ${marketEnv.tradingBias}`
    : null
  if (marketEnvironmentNote) {
    reasoningSummary += ` ${marketEnvironmentNote}`
  }

  const humanSignals = input.context.emotionalIntelligence
    ? pickEmotionalIntelligenceLines(input.context.emotionalIntelligence, 2)
    : []

  return {
    verdict,
    score: input.score,
    technicalSetupVerdict,
    technicalSetupScore,
    traderStateVerdict,
    traderStateScore,
    riskConditionsVerdict,
    riskConditionsScore,
    psychologyOverride,
    overrideReasons,
    finalDecisionExplanation: finalWithRisk,
    psychologyClarification,
    traderStateMetrics,
    structuralStrength: strength,
    positiveFactors,
    negativeFactors,
    criticalBlockers,
    elevatedBlockers,
    technicalBlockers,
    traderStateBlockers,
    riskBlockers,
    dominantDecidingFactor,
    whyNotTake,
    reasoningSummary,
    marketEnvironmentNote,
    humanSignals,
    technicalLayerLabel,
    traderLayerLabel,
    finalActionLabel,
    executionRiskLevel,
    bestAction,
    coachHeadline,
    confidenceExplanation,
    historicalPatternMemory,
    whatWouldMakeTradable,
    emotionalConfidence: input.context.sessionRecovery?.emotionalConfidence ?? null,
    emotionalConfidenceReasons: input.context.sessionRecovery?.confidenceReasons ?? [],
    sessionRecoveryPhase: input.context.sessionRecovery?.phase ?? null,
  }
}

/** Concise summary for chart footers — full detail lives in expandable UI panel */
export function formatVerdictReasoningBrief(reasoning: VerdictReasoning): string {
  const lines: string[] = [
    "",
    `**Technical setup:** ${reasoning.technicalLayerLabel} (${reasoning.technicalSetupScore}/100)`,
    `**Trader state:** ${reasoning.traderLayerLabel} (${reasoning.traderStateScore}/100)`,
    `**Best action:** ${reasoning.finalActionLabel} — ${reasoning.bestAction}`,
    reasoning.coachHeadline,
  ]
  if (reasoning.confidenceExplanation) {
    lines.push(reasoning.confidenceExplanation)
  }
  if (reasoning.psychologyClarification) {
    lines.push("", reasoning.psychologyClarification)
  }
  if (reasoning.humanSignals[0]) {
    lines.push("", `**Psychology read:** ${reasoning.humanSignals.join(" ")}`)
  }
  if (reasoning.verdict !== "TAKE" && reasoning.whyNotTake[0]) {
    lines.push("", `**Why not TAKE?** ${reasoning.whyNotTake[0]}`)
  }
  return lines.join("\n")
}

export function formatVerdictReasoningSection(reasoning: VerdictReasoning): string {
  return formatVerdictReasoningBrief(reasoning)
}
