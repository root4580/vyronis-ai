import { getTodayTrades, getTradeTimestamp } from "@/lib/user-settings"
import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type { RecentTradeMemory } from "@/lib/intelligence/conversational-types"
import { detectTraderPatterns } from "@/lib/intelligence/pattern-intelligence-engine"

const IMPULSIVE = new Set([
  "fomo",
  "revenge",
  "euphoric",
  "anxious",
  "tilted",
  "impulsive",
  "frustrated",
])

export type EmotionalSessionPhase =
  | "RECOVERING"
  | "CALM"
  | "FOCUSED"
  | "ELEVATED"
  | "UNSTABLE"
  | "REVENGE_RISK"

export type EmotionalCarryoverMode =
  | "active_instability"
  | "historical_caution"
  | "recovered"

export type EmotionalConfidenceLevel = "HIGH" | "MEDIUM" | "LOW"

export type RecoverySignalId =
  | "no_trades_today"
  | "journal_reflection"
  | "overnight_reset"
  | "calm_session_start"
  | "rules_restored"
  | "cooldown_elapsed"

export type SessionGuardAdaptation = "standard" | "soft_caution" | "aggressive_protect"

export type SessionRecoverySnapshot = {
  phase: EmotionalSessionPhase
  carryoverMode: EmotionalCarryoverMode
  emotionalConfidence: EmotionalConfidenceLevel
  confidenceReasons: string[]
  rawHistoricalRisk: number
  adjustedEmotionalRisk: number
  /** 0 = history fully faded, 1 = full historical weight */
  historicalWeight: number
  recoverySignals: RecoverySignalId[]
  probabilityNarrative: string
  sessionGuardMode: SessionGuardAdaptation
  /** Softer copy for Session Guard / blockers */
  cautionSummary: string
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function isImpulsiveEmotion(emotion: string | null | undefined): boolean {
  if (!emotion) return false
  return IMPULSIVE.has(emotion.toLowerCase().trim())
}

function hoursSince(ms: number, now = Date.now()): number {
  return Math.max(0, (now - ms) / (1000 * 60 * 60))
}

function computeHistoricalRisk(context: FullTraderContext): number {
  let risk = 22
  const { emotionalState, recentTrades } = context

  if (emotionalState.trend === "volatile") risk += 28
  else if (emotionalState.trend === "elevated") risk += 14

  if (emotionalState.impulsiveCount >= 2) risk += 18
  else if (emotionalState.impulsiveCount === 1) risk += 8

  if (isImpulsiveEmotion(emotionalState.dominantEmotion)) risk += 16

  const historicalImpulsive = recentTrades.filter((t) => isImpulsiveEmotion(t.emotion))
  if (historicalImpulsive.length >= 3) risk += 12
  else if (historicalImpulsive.length >= 2) risk += 6

  const patterns = detectTraderPatterns(context)
  if (patterns.some((p) => p.id === "reversal_chasing")) risk += 14
  if (patterns.some((p) => p.id === "fomo_entries")) risk += 10

  const shadow = context.autonomous?.shadow
  if (shadow && shadow.revengeTradingSignal >= 40) risk += 10

  return clamp(risk)
}

function findLastImpulsiveTradeMs(trades: RecentTradeMemory[]): number | null {
  for (const t of trades) {
    if (isImpulsiveEmotion(t.emotion)) {
      return getTradeTimestamp(t)
    }
  }
  return null
}

function computeDecayMultiplier(input: {
  hoursSinceLastImpulsive: number | null
  noTradesToday: boolean
  overnightGap: boolean
  recoverySignalCount: number
}): number {
  let historicalWeight = 1

  if (input.hoursSinceLastImpulsive != null) {
    const h = input.hoursSinceLastImpulsive
    if (h >= 48) historicalWeight = Math.min(historicalWeight, 0.2)
    else if (h >= 24) historicalWeight = Math.min(historicalWeight, 0.35)
    else if (h >= 12) historicalWeight = Math.min(historicalWeight, 0.5)
    else if (h >= 6) historicalWeight = Math.min(historicalWeight, 0.65)
    else if (h >= 2) historicalWeight = Math.min(historicalWeight, 0.85)
  }

  if (input.overnightGap && input.noTradesToday) {
    historicalWeight = Math.min(historicalWeight, 0.45)
  }

  if (input.noTradesToday) {
    historicalWeight *= 0.72
  }

  if (input.recoverySignalCount >= 3) {
    historicalWeight *= 0.78
  } else if (input.recoverySignalCount >= 2) {
    historicalWeight *= 0.88
  }

  return clamp(historicalWeight * 100) / 100
}

function detectActiveInstability(context: FullTraderContext, todayTrades: RecentTradeMemory[]): boolean {
  const planned = String(
    context.activePlannedContext?.emotion || "",
  ).toLowerCase()
  if (isImpulsiveEmotion(planned)) return true

  if (todayTrades.some((t) => isImpulsiveEmotion(t.emotion))) return true

  const todayImpulsiveCount = todayTrades.filter((t) => isImpulsiveEmotion(t.emotion)).length
  if (todayImpulsiveCount >= 1 && context.emotionalState.trend === "volatile") return true

  return false
}

function detectRevengeRisk(context: FullTraderContext, todayTrades: RecentTradeMemory[]): boolean {
  const planned = String(context.activePlannedContext?.emotion || "").toLowerCase()
  if (planned === "revenge") return true
  if (todayTrades.some((t) => /revenge/i.test(t.emotion || ""))) return true

  const recentLosses = context.recentTrades.slice(0, 3).filter((t) => t.result === "LOSS").length
  const revengeSignal = context.autonomous?.shadow?.revengeTradingSignal ?? 0
  if (todayTrades.length > 0 && recentLosses >= 2 && revengeSignal >= 35) return true

  return detectTraderPatterns(context).some((p) => p.id === "reversal_chasing") && todayTrades.length > 0
}

function collectRecoverySignals(context: FullTraderContext, now = new Date()): RecoverySignalId[] {
  const signals: RecoverySignalId[] = []
  const todayTrades = getTodayTrades(context.recentTrades, now)

  if (todayTrades.length === 0) {
    signals.push("no_trades_today")
  }

  const lastImpulsiveMs = findLastImpulsiveTradeMs(context.recentTrades)
  if (lastImpulsiveMs != null && hoursSince(lastImpulsiveMs, now.getTime()) >= 6) {
    signals.push("cooldown_elapsed")
  }

  if (todayTrades.length === 0) {
    const hadPriorDayImpulsive = context.recentTrades.some((t) => {
      const isToday = getTodayTrades([t], now).length > 0
      return !isToday && isImpulsiveEmotion(t.emotion)
    })
    if (hadPriorDayImpulsive) {
      signals.push("overnight_reset")
    }
  }

  const rulesTotal = context.dailyRules.length
  const rulesChecked = context.dailyRules.filter((r) => r.checked).length
  if (rulesTotal > 0 && rulesChecked / rulesTotal >= 0.75) {
    signals.push("rules_restored")
  }

  const plannedEmotion = context.activePlannedContext?.emotion
  if (
    todayTrades.length === 0 &&
    (!plannedEmotion || !isImpulsiveEmotion(plannedEmotion))
  ) {
    signals.push("calm_session_start")
  }

  const userMessagesToday = context.recentMessages.filter((m) => {
    if (m.role !== "user") return false
    const created = new Date(m.created_at).toDateString()
    return created === now.toDateString() && (m.content?.length ?? 0) >= 24
  })
  if (userMessagesToday.length >= 1) {
    signals.push("journal_reflection")
  }

  return [...new Set(signals)]
}

function derivePhase(input: {
  activeInstability: boolean
  revengeRisk: boolean
  adjustedRisk: number
  carryoverMode: EmotionalCarryoverMode
  recoverySignals: RecoverySignalId[]
  noTradesToday: boolean
}): EmotionalSessionPhase {
  if (input.revengeRisk && (input.activeInstability || !input.noTradesToday)) {
    return "REVENGE_RISK"
  }
  if (input.activeInstability && input.adjustedRisk >= 58) {
    return "UNSTABLE"
  }
  if (input.revengeRisk) {
    return "REVENGE_RISK"
  }
  if (
    input.carryoverMode === "historical_caution" &&
    input.recoverySignals.length >= 2 &&
    input.noTradesToday
  ) {
    return "RECOVERING"
  }
  if (input.adjustedRisk >= 52 && input.carryoverMode !== "recovered") {
    return "ELEVATED"
  }
  if (
    input.recoverySignals.includes("rules_restored") &&
    input.adjustedRisk < 42 &&
    !input.activeInstability
  ) {
    return "FOCUSED"
  }
  if (input.adjustedRisk < 38 && !input.activeInstability) {
    return "CALM"
  }
  if (input.carryoverMode === "recovered") {
    return "CALM"
  }
  return input.noTradesToday ? "RECOVERING" : "ELEVATED"
}

function deriveConfidence(input: {
  phase: EmotionalSessionPhase
  carryoverMode: EmotionalCarryoverMode
  recoverySignals: RecoverySignalId[]
  noTradesToday: boolean
  activeInstability: boolean
}): { level: EmotionalConfidenceLevel; reasons: string[] } {
  const reasons: string[] = []

  if (input.noTradesToday) {
    reasons.push("No new trades today — current session has not confirmed instability")
  }
  if (input.carryoverMode === "historical_caution") {
    reasons.push("Prior session(s) elevated caution — weighted with decay, not treated as certainty")
  }
  if (input.recoverySignals.includes("overnight_reset")) {
    reasons.push("Overnight gap since last impulsive journal entry")
  }
  if (input.recoverySignals.includes("cooldown_elapsed")) {
    reasons.push("Cooldown period since last impulsive trade")
  }
  if (input.activeInstability) {
    reasons.push("Current session behavior confirms elevated emotional risk")
  }
  if (
    input.noTradesToday &&
    reasons.length <= 2 &&
    !input.activeInstability
  ) {
    reasons.push("Insufficient current-session execution data — using historical prior only")
  }

  let level: EmotionalConfidenceLevel = "MEDIUM"
  if (input.phase === "CALM" || input.phase === "FOCUSED") {
    level = "HIGH"
  } else if (
    input.phase === "UNSTABLE" ||
    input.phase === "REVENGE_RISK" ||
    input.activeInstability
  ) {
    level = "LOW"
  } else if (input.carryoverMode === "historical_caution" && input.noTradesToday) {
    level = "LOW"
  } else if (input.phase === "RECOVERING") {
    level = "MEDIUM"
  }

  return { level, reasons: reasons.slice(0, 5) }
}

function buildProbabilityNarrative(input: {
  carryoverMode: EmotionalCarryoverMode
  phase: EmotionalSessionPhase
  activeInstability: boolean
  noTradesToday: boolean
  rawHistoricalRisk: number
  adjustedEmotionalRisk: number
}): string {
  if (input.activeInstability) {
    return "Current session behavior is confirming elevated emotional risk — protective mode is appropriate."
  }
  if (input.carryoverMode === "historical_caution" && input.noTradesToday) {
    return "Recent sessions suggest elevated caution, though current session behavior has not confirmed instability yet."
  }
  if (input.phase === "RECOVERING") {
    return "Historical stress is fading with time and clean session behavior — stay deliberate, not reactive."
  }
  if (input.carryoverMode === "recovered" || input.adjustedEmotionalRisk < 35) {
    return "Emotional carryover is low — prior volatility is unlikely to dominate this session without new triggers."
  }
  if (input.rawHistoricalRisk > input.adjustedEmotionalRisk + 15) {
    return "Prior journal volatility is noted, but decay and a quiet session are reducing how much it should influence you now."
  }
  return "Emotional read is mixed — weigh structure and confirmation over remembered stress."
}

function buildCautionSummary(input: {
  phase: EmotionalSessionPhase
  carryoverMode: EmotionalCarryoverMode
  sessionGuardMode: SessionGuardAdaptation
}): string {
  if (input.sessionGuardMode === "aggressive_protect") {
    return "Protective escalation — revenge or active instability detected in this session."
  }
  if (input.sessionGuardMode === "soft_caution") {
    return "Historical caution only — softer guardrails until today's behavior confirms risk."
  }
  if (input.phase === "FOCUSED" || input.phase === "CALM") {
    return "Process stable enough for standard execution discipline."
  }
  return "Moderate caution — verify confirmation before sizing."
}

/**
 * Context-aware emotional carryover: decays historical instability,
 * separates active vs historical signals, and adapts Session Guard strictness.
 */
export function buildSessionRecovery(
  context: FullTraderContext,
  now = new Date(),
): SessionRecoverySnapshot {
  const todayTrades = getTodayTrades(context.recentTrades, now)
  const noTradesToday = todayTrades.length === 0
  const rawHistoricalRisk = computeHistoricalRisk(context)
  const recoverySignals = collectRecoverySignals(context, now)

  const lastImpulsiveMs = findLastImpulsiveTradeMs(context.recentTrades)
  const hoursSinceImpulsive = lastImpulsiveMs != null ? hoursSince(lastImpulsiveMs, now.getTime()) : null

  const overnightGap = recoverySignals.includes("overnight_reset")
  const historicalWeight = computeDecayMultiplier({
    hoursSinceLastImpulsive: hoursSinceImpulsive,
    noTradesToday,
    overnightGap,
    recoverySignalCount: recoverySignals.length,
  })

  const activeInstability = detectActiveInstability(context, todayTrades)
  const revengeRisk = detectRevengeRisk(context, todayTrades)

  let adjustedEmotionalRisk = clamp(
    rawHistoricalRisk * historicalWeight + (activeInstability ? 28 : 0) + (revengeRisk ? 22 : 0),
  )

  if (revengeRisk && todayTrades.length > 0) {
    adjustedEmotionalRisk = Math.max(adjustedEmotionalRisk, 78)
  }
  if (activeInstability) {
    adjustedEmotionalRisk = Math.max(adjustedEmotionalRisk, 65)
  }

  let carryoverMode: EmotionalCarryoverMode = "recovered"
  if (activeInstability || revengeRisk) {
    carryoverMode = "active_instability"
  } else if (rawHistoricalRisk >= 40) {
    // Latent stress from prior sessions — decay affects score, not whether history matters
    carryoverMode =
      noTradesToday || adjustedEmotionalRisk >= 30 ? "historical_caution" : "recovered"
  }

  let sessionGuardMode: SessionGuardAdaptation = "standard"
  if (revengeRisk || (activeInstability && !noTradesToday)) {
    sessionGuardMode = "aggressive_protect"
  } else if (
    carryoverMode === "historical_caution" &&
    noTradesToday &&
    !activeInstability
  ) {
    sessionGuardMode = "soft_caution"
  } else if (activeInstability) {
    sessionGuardMode = "aggressive_protect"
  }

  const phase = derivePhase({
    activeInstability,
    revengeRisk,
    adjustedRisk: adjustedEmotionalRisk,
    carryoverMode,
    recoverySignals,
    noTradesToday,
  })

  const { level: emotionalConfidence, reasons: confidenceReasons } = deriveConfidence({
    phase,
    carryoverMode,
    recoverySignals,
    noTradesToday,
    activeInstability,
  })

  return {
    phase,
    carryoverMode,
    emotionalConfidence,
    confidenceReasons,
    rawHistoricalRisk,
    adjustedEmotionalRisk,
    historicalWeight,
    recoverySignals,
    probabilityNarrative: buildProbabilityNarrative({
      carryoverMode,
      phase,
      activeInstability,
      noTradesToday,
      rawHistoricalRisk,
      adjustedEmotionalRisk,
    }),
    sessionGuardMode,
    cautionSummary: buildCautionSummary({ phase, carryoverMode, sessionGuardMode }),
  }
}

/** Effective emotional risk for scoring (replaces raw shadow/history when recovery present). */
export function effectiveEmotionalRisk(
  context: FullTraderContext,
  shadowRisk?: number | null,
): number {
  const recovery = context.sessionRecovery
  if (recovery) {
    const shadow = shadowRisk ?? context.autonomous?.shadow?.emotionalRiskScore ?? recovery.adjustedEmotionalRisk
    if (recovery.carryoverMode === "historical_caution" && recovery.sessionGuardMode === "soft_caution") {
      return clamp(Math.min(shadow, recovery.adjustedEmotionalRisk + 8))
    }
    if (recovery.carryoverMode === "active_instability") {
      return clamp(Math.max(shadow, recovery.adjustedEmotionalRisk))
    }
    return recovery.adjustedEmotionalRisk
  }
  return shadowRisk ?? 50
}

export function shouldTreatEmotionalBlockerAsCritical(context: FullTraderContext): boolean {
  const r = context.sessionRecovery
  if (!r) {
    return (
      context.emotionalState.trend === "volatile" ||
      context.emotionalState.impulsiveCount >= 2
    )
  }
  return (
    r.sessionGuardMode === "aggressive_protect" ||
    r.phase === "UNSTABLE" ||
    r.phase === "REVENGE_RISK" ||
    r.carryoverMode === "active_instability"
  )
}

export function emotionalInstabilityBlockerMessage(context: FullTraderContext): string {
  const r = context.sessionRecovery
  const planned = String(
    context.activePlannedContext?.emotion || context.emotionalState.dominantEmotion || "",
  ).toLowerCase()

  if (r?.carryoverMode === "historical_caution" && r.sessionGuardMode === "soft_caution") {
    return r.probabilityNarrative
  }

  if (planned && IMPULSIVE.has(planned)) {
    return `Current session reads ${planned} — that state often reduces execution quality even when structure looks fine.`
  }

  if (r?.carryoverMode === "active_instability") {
    return "Current session behavior is confirming elevated emotional risk — size down or pause."
  }

  return (
    r?.probabilityNarrative ??
    "Recent sessions suggest elevated caution — current behavior has not fully confirmed instability yet."
  )
}
