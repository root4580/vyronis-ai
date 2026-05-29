import type { TradeDecisionRecommendation } from "@/lib/intelligence/intelligence-types"
import type { DetectedTraderPattern } from "@/lib/intelligence/pattern-intelligence-engine"
import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type { VerdictBlocker } from "@/lib/intelligence/verdict-reasoning-engine"

export type LayerQualityLabel = "GOOD" | "FAIR" | "WEAK" | "STABLE" | "ELEVATED" | "COMPROMISED"
export type ExecutionRiskLevel = "LOW" | "MEDIUM" | "HIGH"

export function scoreToTechnicalLabel(score: number): LayerQualityLabel {
  if (score >= 68) return "GOOD"
  if (score >= 50) return "FAIR"
  return "WEAK"
}

export function scoreToTraderLabel(score: number): LayerQualityLabel {
  if (score >= 68) return "STABLE"
  if (score >= 50) return "ELEVATED"
  return "COMPROMISED"
}

export function deriveExecutionRiskLevel(input: {
  finalVerdict: TradeDecisionRecommendation
  traderScore: number
  riskScore: number
  criticalCount: number
}): ExecutionRiskLevel {
  const { finalVerdict, traderScore, riskScore, criticalCount } = input
  if (finalVerdict === "SKIP" || criticalCount >= 2 || traderScore < 42 || riskScore < 40) {
    return "HIGH"
  }
  if (finalVerdict === "CAUTION" || traderScore < 58 || riskScore < 55) {
    return "MEDIUM"
  }
  return "LOW"
}

export function deriveBestAction(
  verdict: TradeDecisionRecommendation,
  executionRisk: ExecutionRiskLevel,
): string {
  if (verdict === "SKIP" || executionRisk === "HIGH") {
    return "PAUSE / WAIT FOR RESET"
  }
  if (verdict === "CAUTION") {
    return "REDUCE SIZE / WAIT FOR CONFIRMATION"
  }
  return "EXECUTE WITH PLAN"
}

export function deriveFinalActionLabel(
  verdict: TradeDecisionRecommendation,
): "TAKE" | "REDUCE" | "SKIP" | "WAIT" {
  if (verdict === "TAKE") return "TAKE"
  if (verdict === "SKIP") return "SKIP"
  return "REDUCE"
}

export function buildConfidenceExplanation(input: {
  technicalScore: number
  traderScore: number
  metrics: {
    emotionalRisk: number | null
    disciplineConfidence: number | null
    executionQuality: number | null
  }
  psychologyOverride: boolean
  sessionRecovery?: import("@/lib/intelligence/session-recovery-engine").SessionRecoverySnapshot | null
}): string | null {
  const { technicalScore, traderScore, metrics, psychologyOverride, sessionRecovery } = input
  if (!psychologyOverride && traderScore >= 58) return null

  const gap = Math.max(0, technicalScore - traderScore)
  if (gap < 12 && !psychologyOverride) return null

  const parts: string[] = []
  if (technicalScore >= 55) {
    parts.push("Setup quality is acceptable")
  } else {
    parts.push("Setup quality is only marginal")
  }

  if (sessionRecovery?.sessionGuardMode === "soft_caution") {
    parts.push(
      "but recent sessions suggest elevated caution — today's behavior has not confirmed instability yet",
    )
  } else if (metrics.executionQuality != null && metrics.executionQuality < 55) {
    const drop = Math.min(45, Math.max(18, Math.round((55 - metrics.executionQuality) * 0.85)))
    parts.push(
      `but when emotional risk is elevated, historical execution quality often drops by roughly ${drop}%`,
    )
  } else if (gap >= 15) {
    parts.push(
      `but your trader state is ${gap} points weaker than the chart — execution quality may suffer`,
    )
  } else {
    parts.push("but process alignment is not strong enough yet to trust full size")
  }

  return `${parts.join(", ")}.`
}

export function buildHistoricalPatternMemory(
  context: FullTraderContext,
  patterns: DetectedTraderPattern[],
): string | null {
  const losses = context.recentTrades.filter((t) => t.result === "LOSS").slice(0, 8)
  const impulsiveLosses = losses.filter((t) =>
    /fomo|revenge|anxious|euphoric|tilted|impulsive/i.test(String(t.emotion)),
  )

  const continuation = patterns.find((p) => p.id === "continuation_bias")
  if (continuation && continuation.count && continuation.count >= 2) {
    return `This resembles your last ${Math.min(continuation.count, 3)} continuation losses after emotional overtrading — same energy, similar outcome risk.`
  }

  if (impulsiveLosses.length >= 2) {
    const pairs = [...new Set(impulsiveLosses.slice(0, 3).map((t) => t.pair))].join(", ")
    return `Your last ${impulsiveLosses.length} impulsive losses (${pairs || "recent pairs"}) looked like this — process broke before the market did.`
  }

  const reversal = patterns.find((p) => p.id === "reversal_chasing")
  if (reversal) {
    return "This matches your recent reversal-chase losses — trying to win back movement instead of waiting for structure."
  }

  const fomo = patterns.find((p) => p.id === "fomo_entries")
  if (fomo && fomo.count && fomo.count >= 2) {
    return `Similar to ${fomo.count} recent FOMO-tagged entries — entries rushed before confirmation settled.`
  }

  const comparative = context.recentTrades.filter((t) => t.result === "LOSS").length
  if (comparative >= 3 && context.emotionalState.trend === "volatile") {
    return "Your recent journal shows volatile emotion across multiple losses — not an isolated bad read."
  }

  return null
}

export function buildWhatWouldMakeTradable(input: {
  context: FullTraderContext
  technicalBlockers: VerdictBlocker[]
  traderBlockers: VerdictBlocker[]
  riskBlockers: VerdictBlocker[]
  traderScore: number
}): string[] {
  const suggestions: string[] = []
  const { context, technicalBlockers, traderBlockers, riskBlockers } = input
  const all = [...technicalBlockers, ...traderBlockers, ...riskBlockers]

  const has = (id: string) => all.some((b) => b.id === id)
  const session = String(context.activePlannedContext?.session || "").toLowerCase()

  if (has("poor_session") || (!session.includes("london") && !session.includes("new york"))) {
    suggestions.push("Wait for your preferred session (e.g. London open) before committing size")
  }
  if (has("emotional_instability") || has("revenge_behavior") || input.traderScore < 50) {
    suggestions.push("Take a 20–30 minute reset — journal one sentence on what you are trying to prove")
  }
  if (has("drawdown_limit") || has("daily_trade_limit") || has("overtrading")) {
    suggestions.push(`Cap risk at ${Math.max(0.25, context.settings.max_risk_per_trade * 0.25).toFixed(2)}% until process stabilizes`)
  } else if (input.traderScore < 62) {
    suggestions.push(`Reduce risk to ${Math.max(0.25, context.settings.max_risk_per_trade * 0.5).toFixed(2)}% for the next execution`)
  }
  if (has("late_entry") || has("weak_confirmation")) {
    suggestions.push("Only take a retest entry — no chase into the move")
  }
  if (has("htf_ltf_conflict") || has("countertrend")) {
    suggestions.push("Require H1 structure reclaim and LTF confirmation before entry")
  }
  if (has("invalid_rr")) {
    suggestions.push("Widen target or tighten stop until R:R clears your minimum")
  }
  if (has("news_volatility") || has("market_expanded_vol")) {
    suggestions.push("Wait for volatility to settle post-news before sizing up")
  }

  if (suggestions.length === 0 && input.traderScore < 68) {
    suggestions.push("One clean demo execution with half size to rebuild rhythm")
  }

  return [...new Set(suggestions)].slice(0, 5)
}

export function buildCoachHeadline(input: {
  finalVerdict: TradeDecisionRecommendation
  technicalLabel: LayerQualityLabel
  traderLabel: LayerQualityLabel
  psychologyOverride: boolean
}): string {
  const { finalVerdict, technicalLabel, traderLabel, psychologyOverride } = input
  if (psychologyOverride && technicalLabel === "GOOD") {
    return "The chart is workable — your process needs a reset before you click."
  }
  if (finalVerdict === "SKIP" && traderLabel === "COMPROMISED") {
    return "Standing aside is discipline here, not missing the market."
  }
  if (finalVerdict === "CAUTION") {
    return "There is edge, but only if you trade it smaller and slower."
  }
  return "Structure and state align — execute your plan with calm precision."
}

/** Collapse duplicate / overlapping reason lines */
export function dedupeReasonLines(lines: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const key = line
      .toLowerCase()
      .replace(/emotional state flagged/g, "emotion")
      .replace(/\s+/g, " ")
      .slice(0, 80)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
  }
  return out
}

export function softenBlockerMessage(id: string, message: string, emotion?: string): string {
  if (id === "emotional_instability") {
    if (emotion) {
      return `Process reads ${emotion} — that state historically hurts execution even on decent setups.`
    }
    return "Recent journal shows emotional volatility — process needs stabilizing before full size."
  }
  if (id === "revenge_behavior") {
    return "Revenge or counter-trend energy is showing up in recent trades."
  }
  if (message.toLowerCase().includes("emotional state flagged")) {
    return message.replace(/Emotional state flagged:\s*/i, "Process reads ").replace(
      / — instability overrides strong structure\./i,
      " — that state usually hurts execution quality.",
    )
  }
  return message
}
