import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type {
  AdaptiveRiskRestriction,
  ConfidenceDecaySnapshot,
  LiveTraderStateSnapshot,
  PreTradeApproval,
  RuleViolationForecast,
  SetupProbabilitySnapshot,
} from "@/lib/vyronis-core/types"

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function buildConfidenceDecay(context: FullTraderContext): ConfidenceDecaySnapshot {
  const shadow = context.autonomous?.shadow
  const todayCount = context.memory.snapshot.todayTradeCount
  const maxTrades = context.settings.max_trades_per_day
  const factors: string[] = []
  let decayRate = 0
  let current = shadow?.disciplineConfidence ?? 70

  if (todayCount >= maxTrades - 1) {
    decayRate += 18
    factors.push("Near daily trade limit")
  }
  if (context.emotionalState.trend === "volatile") {
    decayRate += 22
    factors.push("Volatile emotional trend")
  }
  const recentLosses = context.recentTrades.slice(0, 3).filter((t) => t.result === "LOSS").length
  if (recentLosses >= 2) {
    decayRate += 15
    factors.push("Recent loss cluster")
  }
  if ((shadow?.disciplineDrift ?? 0) >= 40) {
    decayRate += 12
    factors.push("Discipline drift elevated")
  }

  current = clamp(current - decayRate)
  const sessionFatigue = todayCount >= Math.max(2, maxTrades - 2) && decayRate >= 20

  return {
    currentConfidence: current,
    decayRate: clamp(decayRate),
    factors,
    sessionFatigue,
    narrative: sessionFatigue
      ? "Session fatigue detected — confidence decaying; quality over quantity."
      : decayRate > 0
        ? `Confidence decay ~${decayRate}% from session pressure.`
        : "Confidence stable for this session window.",
  }
}

export function buildSetupProbability(context: FullTraderContext): SetupProbabilitySnapshot {
  const planned = context.activePlannedContext
  const dna = context.autonomous?.traderDna
  const pattern = context.autonomous?.patternMatch
  let score = 50
  let historicalWinRate: number | null = null

  if (pattern?.similarityScore) {
    score = pattern.similarityScore
    if (pattern.bestMatch?.clusterType === "win") historicalWinRate = 65
    if (pattern.bestMatch?.clusterType === "loss") {
      score = Math.min(score, 42)
      historicalWinRate = 35
    }
  }

  if (planned?.vision_score != null) {
    score = Math.round((score + Number(planned.vision_score)) / 2)
  }
  if (planned?.entry_confirmation_score != null) {
    score = Math.round((score + Number(planned.entry_confirmation_score)) / 2)
  }

  const envFit = context.cognitive?.marketEnvironment.confidence ?? 50
  score = clamp(Math.round(score * 0.7 + envFit * 0.3))

  return {
    score,
    historicalWinRate,
    patternMatch: pattern?.narrative ?? null,
    environmentFit: envFit,
    narrative:
      score >= 68
        ? "Setup probability elevated — still require emotional clearance."
        : score >= 50
          ? "Marginal setup probability — CAUTION default."
          : "Low setup probability vs your historical edge.",
  }
}

export function buildAdaptiveRiskRestriction(context: FullTraderContext): AdaptiveRiskRestriction {
  const intervention = context.tradingOs?.intervention
  const maxRisk = context.settings.max_risk_per_trade
  const multiplier = intervention?.suggestedRiskMultiplier ?? 1
  const restrictions: string[] = []

  if (intervention?.active) {
    restrictions.push(intervention.message)
    for (const action of intervention.actions) {
      restrictions.push(action.replace(/_/g, " "))
    }
  }

  const maxRiskPercent = Math.round(maxRisk * multiplier * 100) / 100

  return {
    active: Boolean(intervention?.active) || multiplier < 1,
    maxRiskPercent,
    maxTradesRemaining: Math.max(
      0,
      context.settings.max_trades_per_day - context.memory.snapshot.todayTradeCount,
    ),
    restrictions: restrictions.slice(0, 5),
  }
}

export function buildLiveTraderState(context: FullTraderContext): LiveTraderStateSnapshot {
  const cognitive = context.cognitive?.state.primary ?? "unknown"
  const shadow = context.autonomous?.shadow
  const drift = context.tradingOs?.liveSession.emotionalDriftScore ?? 0

  let emotionalDanger: LiveTraderStateSnapshot["emotionalDanger"] = "low"
  if (shadow?.overallRiskLevel === "critical" || drift >= 80) emotionalDanger = "critical"
  else if (shadow?.overallRiskLevel === "elevated" || drift >= 60) emotionalDanger = "high"
  else if (drift >= 40) emotionalDanger = "moderate"

  const fatigueLevel = clamp(
    (context.tradingOs?.liveSession.overtradingLevel === "critical" ? 85 : 0) +
      (buildConfidenceDecay(context).sessionFatigue ? 25 : 0) +
      drift * 0.3,
  )

  return {
    state: cognitive,
    emotionalDanger,
    fatigueLevel,
    interventionActive: Boolean(context.tradingOs?.intervention.active),
    narrative: `Live state: ${cognitive.replace(/_/g, " ")} · emotional danger ${emotionalDanger} · fatigue ${fatigueLevel}/100`,
  }
}

export function buildRuleViolationForecast(context: FullTraderContext): RuleViolationForecast {
  const likelyViolations: string[] = []
  let probability = 15

  if (context.activePlannedContext?.risk_percent) {
    const planned = Number(context.activePlannedContext.risk_percent)
    if (planned > context.settings.max_risk_per_trade) {
      probability += 35
      likelyViolations.push("Risk percent exceeds max rule")
    }
  }

  if (context.memory.snapshot.todayTradeCount >= context.settings.max_trades_per_day) {
    probability += 40
    likelyViolations.push("Daily trade count limit")
  }

  const failedRules = context.dailyRules.filter((r) => !r.checked)
  if (failedRules.length > 0) {
    probability += failedRules.length * 12
    likelyViolations.push(...failedRules.map((r) => r.rule))
  }

  if (/fomo|revenge|euphoric/i.test(context.activePlannedContext?.emotion || "")) {
    probability += 28
    likelyViolations.push("Impulsive emotion tag on entry")
  }

  return {
    probability: clamp(probability),
    likelyViolations: likelyViolations.slice(0, 4),
    narrative:
      probability >= 55
        ? "High probability of rule violation if you proceed without reset."
        : "Rule violation risk manageable with checklist discipline.",
  }
}

export function buildPreTradeApproval(context: FullTraderContext): PreTradeApproval {
  const shadow = context.autonomous?.shadow
  const intervention = context.tradingOs?.intervention
  const setup = buildSetupProbability(context)
  const rules = buildRuleViolationForecast(context)
  const reasons: string[] = []

  let verdict: PreTradeApproval["verdict"] = "CAUTION"
  let status: PreTradeApproval["status"] = "reduced"
  let riskMultiplier = intervention?.suggestedRiskMultiplier ?? 1

  const psychologyOverride =
    Boolean(context.cognitive?.state.primary === "revenge_driven" ||
      context.cognitive?.state.primary === "impulsive") &&
    setup.score >= 55

  if (shadow?.shouldPause || (intervention?.active && !intervention.canProceedToEntry)) {
    verdict = "SKIP"
    status = "blocked"
    riskMultiplier = 0
    reasons.push(intervention?.message ?? shadow?.proactiveMessage ?? "Shadow pause active")
  } else if (rules.probability >= 60 || setup.score < 45) {
    verdict = "SKIP"
    status = "reflection_required"
    riskMultiplier = 0
    reasons.push(...rules.likelyViolations)
  } else if (setup.score >= 68 && (shadow?.overallRiskLevel === "low" || shadow?.overallRiskLevel === "moderate")) {
    verdict = "TAKE"
    status = "approved"
    reasons.push("Setup probability and shadow risk within bounds")
  } else {
    reasons.push(setup.narrative)
    if (intervention?.active) reasons.push(intervention.headline)
  }

  if (psychologyOverride && verdict === "TAKE") {
    verdict = "SKIP"
    status = "reflection_required"
    reasons.push("Psychology override — trader state overrides setup quality")
  }

  return {
    status,
    verdict,
    riskMultiplier,
    headline:
      status === "blocked"
        ? "Pre-trade blocked"
        : status === "approved"
          ? "Pre-trade approved"
          : status === "reflection_required"
            ? "Reflection required before entry"
            : "Reduced size recommended",
    reasons: reasons.slice(0, 5),
    psychologyOverride,
    shadowPause: Boolean(shadow?.shouldPause),
  }
}

export function buildInterventionPrompt(context: FullTraderContext): string | null {
  const intervention = context.tradingOs?.intervention
  if (intervention?.active) return intervention.message
  const shadow = context.autonomous?.shadow
  if (shadow?.overallRiskLevel === "elevated") return shadow.proactiveMessage
  return null
}
