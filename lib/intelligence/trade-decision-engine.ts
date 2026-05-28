import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import type { FullTraderContext, TradeDecisionResult } from "@/lib/intelligence/intelligence-types"
import { compareSetupToHistory } from "@/lib/intelligence/setup-similarity-engine"
import { filterFreshWarnings } from "@/lib/intelligence/conversation-continuity"

const IMPULSIVE_EMOTIONS = new Set(["fomo", "revenge", "euphoric", "anxious", "tilted"])

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function evaluateTradeDecision(input: {
  context: FullTraderContext
  planned?: PreTradePlannedContext | null
  mentionedWarningIds?: Set<string>
}): TradeDecisionResult | null {
  const planned = input.planned ?? input.context.activePlannedContext
  if (!planned?.pair && !planned?.setup) return null

  const evidence: string[] = []
  let score = 55

  const similarity = compareSetupToHistory({
    planned,
    trades: input.context.recentTrades,
  })

  if (similarity.matchCount > 0) {
    evidence.push(similarity.narrative)
    const winRate =
      similarity.topMatches.filter((m) => m.result === "WIN").length / similarity.topMatches.length
    if (winRate >= 0.6) score += 15
    else if (winRate <= 0.3) score -= 20
  }

  const freshWarnings = filterFreshWarnings(
    input.context.memory.warnings,
    input.mentionedWarningIds ?? new Set(),
  )
  const critical = freshWarnings.filter((w) => w.severity === "critical")
  if (critical.length > 0) {
    score -= 25
    evidence.push(...critical.map((w) => w.message))
  }

  const patternWarnings = input.context.memory.topPatterns.filter((p) => p.severity === "warning")
  if (patternWarnings.length > 0) {
    score -= 10
    evidence.push(patternWarnings[0].message)
  }

  const { risk, settings, memory } = input.context
  if (risk.todayLossPercent >= settings.daily_drawdown_limit * 0.8) {
    score -= 15
    evidence.push(
      `Daily drawdown at ${risk.todayLossPercent.toFixed(1)}% — near ${settings.daily_drawdown_limit}% limit.`,
    )
  }

  if (memory.snapshot.todayTradeCount >= settings.max_trades_per_day) {
    score -= 20
    evidence.push(`Daily trade limit reached (${settings.max_trades_per_day}).`)
  }

  const plannedRisk = Number(planned.risk_percent)
  if (Number.isFinite(plannedRisk) && plannedRisk > settings.max_risk_per_trade) {
    score -= 15
    evidence.push(
      `Planned risk ${plannedRisk}% exceeds your ${settings.max_risk_per_trade}% rule.`,
    )
  }

  const emotion = String(planned.emotion || "").toLowerCase()
  if (IMPULSIVE_EMOTIONS.has(emotion)) {
    score -= 18
    evidence.push(`Planned emotion is ${planned.emotion} — historically a risk multiplier.`)
  }

  if (input.context.emotionalState.trend === "volatile") {
    score -= 10
    evidence.push(input.context.emotionalState.note)
  }

  if (memory.primaryLeak.status === "active") {
    score -= 8
    evidence.push(`${memory.primaryLeak.headline}: ${memory.primaryLeak.correctiveAction}`)
  }

  const failedRules = input.context.dailyRules.filter((r) => !r.checked)
  if (failedRules.length > 0) {
    score -= failedRules.length * 4
    evidence.push(`Open daily rules: ${failedRules.map((r) => r.rule).join("; ")}`)
  }

  if (similarity.topMatches.some((m) => m.result === "LOSS" && m.similarityScore >= 70)) {
    score -= 12
    evidence.push("A highly similar historical setup ended in a loss.")
  }

  if (similarity.topMatches.some((m) => m.result === "WIN" && m.similarityScore >= 70)) {
    score += 8
    evidence.push("A highly similar historical setup won with discipline.")
  }

  const intervention = input.context.tradingOs?.intervention
  if (intervention?.active) {
    evidence.unshift(intervention.message)
    if (!intervention.canProceedToEntry) {
      score = Math.min(score, 35)
    } else if (intervention.suggestedRiskMultiplier < 1) {
      score = Math.min(score, 58)
      evidence.push(
        `Trading OS: reduce size to ~${Math.round(intervention.suggestedRiskMultiplier * 100)}% of planned risk.`,
      )
    }
  }

  score = clampConfidence(score)

  let recommendation: TradeDecisionResult["recommendation"] = "CAUTION"
  if (score >= 72 && critical.length === 0) recommendation = "TAKE"
  if (score <= 42 || (critical.length > 0 && score <= 55)) recommendation = "SKIP"
  if (intervention?.active && !intervention.canProceedToEntry) recommendation = "SKIP"

  let nextQuestion =
    intervention?.reflectionPrompt ??
    "What would need to be true for this to be an A+ execution?"
  if (!intervention?.reflectionPrompt && recommendation === "SKIP") {
    nextQuestion = "What's pulling you toward this trade despite the red flags?"
  } else if (recommendation === "CAUTION") {
    nextQuestion = "Which part of your plan is weakest right now — timing, risk, or emotion?"
  } else {
    nextQuestion = "What's your invalidation level if price disagrees with the thesis?"
  }

  if (evidence.length === 0) {
    evidence.push("No major rule breaks detected — still verify HTF bias and risk before entry.")
  }

  return {
    recommendation,
    confidence: score,
    evidence: evidence.slice(0, 6),
    nextQuestion,
    similarity,
  }
}
