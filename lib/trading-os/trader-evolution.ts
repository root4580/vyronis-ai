import type { EvolutionMetric, TraderEvolutionSnapshot, TradingOsEngineInput } from "@/lib/trading-os/types"

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function trendFromDelta(delta: number): EvolutionMetric["trend"] {
  if (delta >= 8) return "improving"
  if (delta <= -8) return "declining"
  return "stable"
}

function sliceWinRate(trades: TradingOsEngineInput["context"]["recentTrades"], n: number): number {
  const slice = trades.slice(0, n)
  if (slice.length === 0) return 50
  const wins = slice.filter((t) => t.result === "WIN").length
  return Math.round((wins / slice.length) * 100)
}

function ruleRate(trades: TradingOsEngineInput["context"]["recentTrades"], n: number): number {
  const slice = trades.slice(0, n).filter((t) => t.rule_followed != null)
  if (slice.length === 0) return 55
  const ok = slice.filter((t) => t.rule_followed === true).length
  return Math.round((ok / slice.length) * 100)
}

function emotionalStabilityScore(context: TradingOsEngineInput["context"]): number {
  const impulsive = context.recentTrades
    .slice(0, 10)
    .filter((t) => /fomo|revenge|anxious|euphoric|tilted/i.test(t.emotion || "")).length
  const base =
    context.emotionalState.trend === "stable"
      ? 72
      : context.emotionalState.trend === "elevated"
        ? 52
        : 35
  return clamp(base - impulsive * 6)
}

export function buildTraderEvolution(input: TradingOsEngineInput): TraderEvolutionSnapshot {
  const { context } = input
  const recent = context.recentTrades
  const recent5 = recent.slice(0, 5)
  const prior5 = recent.slice(5, 10)

  const disciplineCurrent = ruleRate(recent, 8)
  const disciplinePrior = prior5.length > 0 ? ruleRate(prior5, 5) : disciplineCurrent
  const disciplineTrend: EvolutionMetric = {
    label: "Discipline",
    current: disciplineCurrent,
    prior: disciplinePrior,
    trend: trendFromDelta(disciplineCurrent - disciplinePrior),
    narrative:
      disciplineTrendFrom(disciplineCurrent, disciplinePrior) +
      (context.weeklyReview?.weakestHabit
        ? ` Focus: ${context.weeklyReview.weakestHabit}.`
        : ""),
  }

  const emotionCurrent = emotionalStabilityScore(context)
  const emotionPrior = clamp(
    emotionCurrent +
      (context.emotionalState.trend === "volatile" ? 12 : context.emotionalState.trend === "elevated" ? 6 : -4),
  )
  const emotionalStability: EvolutionMetric = {
    label: "Emotional stability",
    current: emotionCurrent,
    prior: emotionPrior,
    trend: trendFromDelta(emotionCurrent - emotionPrior),
    narrative:
      emotionCurrent >= 65
        ? "Emotional tagging and session control are holding."
        : "Volatile emotions are still leaking into execution — prioritize resets.",
  }

  const execCurrent = context.autonomous?.shadow.disciplineConfidence ?? clamp(ruleRate(recent, 6) + 10)
  const execPrior = clamp(execCurrent - 10)
  const executionConsistency: EvolutionMetric = {
    label: "Execution consistency",
    current: execCurrent,
    prior: execPrior,
    trend: trendFromDelta(execCurrent - execPrior),
    narrative: `Execution forecast ~${context.autonomous?.shadow.executionQualityPrediction ?? execCurrent}/100 from shadow monitoring.`,
  }

  const setupCurrent = sliceWinRate(recent, 8)
  const setupPrior = prior5.length > 0 ? sliceWinRate(prior5, 5) : setupCurrent
  const setupQuality: EvolutionMetric = {
    label: "Setup quality",
    current: setupCurrent,
    prior: setupPrior,
    trend: trendFromDelta(setupCurrent - setupPrior),
    narrative:
      context.autonomous?.traderDna.bestSetupTypes[0]
        ? `Strongest models: ${context.autonomous.traderDna.bestSetupTypes.slice(0, 2).join(", ")}.`
        : "Log setups consistently to sharpen quality tracking.",
  }

  const bestSession = [...context.sessionPerformance]
    .filter((s) => s.tradeCount >= 3)
    .sort((a, b) => b.winRate - a.winRate)[0]

  const bestEnvironment = bestSession
    ? {
        label: bestSession.name,
        winRate: bestSession.winRate,
        tradeCount: bestSession.tradeCount,
      }
    : null

  const overallEvolutionScore = clamp(
    (disciplineCurrent + emotionCurrent + execCurrent + setupCurrent) / 4,
  )

  const weeklyReport = [
    `Weekly evolution: discipline ${disciplineCurrent}% (${disciplineTrend.trend}),`,
    `emotional stability ${emotionCurrent}%, execution ${execCurrent}%.`,
    context.weeklyReview?.headline ? ` Review: ${context.weeklyReview.headline}` : "",
  ].join("")

  const monthlyReport = [
    `Monthly arc: setup win rate ${setupCurrent}% (${setupQuality.trend}),`,
    bestEnvironment
      ? ` best environment ${bestEnvironment.label} (${bestEnvironment.winRate}% WR).`
      : " keep building session sample size.",
    context.autonomous?.traderDna.weeklyInsight
      ? ` DNA: ${context.autonomous.traderDna.weeklyInsight}`
      : "",
  ].join("")

  return {
    disciplineTrend,
    emotionalStability,
    executionConsistency,
    setupQuality,
    bestEnvironment,
    weeklyReport: weeklyReport.trim(),
    monthlyReport: monthlyReport.trim(),
    overallEvolutionScore,
  }
}

function disciplineTrendFrom(current: number, prior: number): string {
  const delta = current - prior
  if (delta >= 8) return "Rule adherence improving vs prior week of trades."
  if (delta <= -8) return "Rule adherence slipping — tighten pre-trade checklist."
  return "Discipline holding steady — protect the streak."
}
