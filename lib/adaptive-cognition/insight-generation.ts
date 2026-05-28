import type { AdaptiveCognitionInput, AutonomousInsight } from "@/lib/adaptive-cognition/types"

export function generateAutonomousInsights(input: AdaptiveCognitionInput): AutonomousInsight[] {
  const { context } = input
  const insights: AutonomousInsight[] = []
  const recent = context.recentTrades

  const winsWithBadProcess = recent.filter(
    (t) => t.result === "WIN" && (t.rule_followed === false || /fomo|euphoric|revenge/i.test(t.emotion || "")),
  )
  if (winsWithBadProcess.length >= 2) {
    insights.push({
      id: "discipline-after-wins",
      pattern: "discipline_after_oversized_wins",
      message: "Your discipline drops after oversized or emotionally tagged wins.",
      confidence: 74,
      category: "discipline",
    })
  }

  const lifePositive = input.lifeContextHistory?.filter(
    (e) => (e.sleepQuality ?? 5) >= 7 && (e.stress ?? 5) <= 4,
  )
  if (lifePositive && lifePositive.length >= 2) {
    insights.push({
      id: "life-morning-edge",
      pattern: "low_emotional_mornings",
      message: "Your best trades happen after low-stress, high-focus mornings.",
      confidence: 66,
      category: "life",
    })
  }

  const reversalForcing = recent.filter(
    (t) =>
      t.result === "LOSS" &&
      /reversal|counter|fade/i.test(`${t.emotion} ${context.cognitive?.marketEnvironment.labels.join(" ")}`),
  )
  if (
    reversalForcing.length >= 2 ||
    context.cognitive?.marketEnvironment.labels.includes("reversal_conditions")
  ) {
    insights.push({
      id: "reversal-uncertainty",
      pattern: "forced_reversals_uncertainty",
      message: "You force reversals during uncertainty environments — wait for expansion.",
      confidence: 70,
      category: "market",
    })
  }

  if (context.emotionalState.trend === "volatile" && recent.filter((t) => t.result === "LOSS").length >= 2) {
    insights.push({
      id: "recovery-speed",
      pattern: "slow_emotional_recovery",
      message: "Emotional recovery after losses is slower than your edge window — pause longer.",
      confidence: 68,
      category: "emotion",
    })
  }

  if (context.tradingOs?.evolution.disciplineTrend.trend === "improving") {
    insights.push({
      id: "identity-growth",
      pattern: "discipline_identity_forming",
      message: "Discipline identity is strengthening — protect streaks, do not celebrate with size.",
      confidence: 72,
      category: "identity",
    })
  }

  const sessionBest = context.sessionPerformance.sort((a, b) => b.winRate - a.winRate)[0]
  if (sessionBest && sessionBest.winRate >= 58 && sessionBest.tradeCount >= 5) {
    insights.push({
      id: "session-edge",
      pattern: "session_edge",
      message: `Edge concentrates in ${sessionBest.name} — default there when in doubt.`,
      confidence: 64,
      category: "execution",
    })
  }

  return insights
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6)
}
