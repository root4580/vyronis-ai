import type { AdaptiveCognitionInput, BehavioralModelSnapshot, BehavioralCycleSignal } from "@/lib/adaptive-cognition/types"

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function buildBehavioralModel(input: AdaptiveCognitionInput): BehavioralModelSnapshot {
  const { context } = input
  const recent = context.recentTrades
  const losses = recent.filter((t) => t.result === "LOSS")
  const wins = recent.filter((t) => t.result === "WIN")

  const revengeSpiral =
    losses.length >= 2 &&
    recent.slice(0, 3).some((t) => /revenge|fomo|tilted/i.test(t.emotion || ""))

  const oversizedWin = wins.some((t) => t.pnl > 0 && t.rule_followed === false)
  const confidenceInflation =
    oversizedWin ||
    (wins.length >= 3 && context.cognitive?.state.primary === "euphoric")

  const disciplineStreak = recent
    .slice(0, 6)
    .every((t) => t.rule_followed === true && !/revenge|fomo/i.test(t.emotion || ""))

  const burnout =
    context.memory.snapshot.todayTradeCount >= context.settings.max_trades_per_day - 1 &&
    context.emotionalState.trend === "volatile" &&
    context.risk.todayLossPercent > context.settings.daily_drawdown_limit * 0.5

  const lastLossIdx = recent.findIndex((t) => t.result === "LOSS")
  const recoveryTrades = lastLossIdx > 0 ? recent.slice(0, lastLossIdx) : []
  const recoverySpeed = clamp(
    recoveryTrades.length === 0
      ? 70
      : recoveryTrades[0]?.result === "WIN" && recoveryTrades[0]?.rule_followed
        ? 82
        : 45,
  )

  const cycles: BehavioralCycleSignal[] = [
    {
      cycle: "burnout",
      active: burnout,
      severity: burnout ? 78 : 15,
      narrative: burnout
        ? "Burnout pattern: high trade count + volatile emotions + drawdown pressure."
        : "No active burnout cycle detected.",
      predictedInstabilityDays: burnout ? 2 : null,
    },
    {
      cycle: "confidence_inflation",
      active: confidenceInflation,
      severity: confidenceInflation ? 65 : 10,
      narrative: confidenceInflation
        ? "Confidence inflation risk after outsized or rule-breaking wins."
        : "Confidence appears measured.",
      predictedInstabilityDays: confidenceInflation ? 3 : null,
    },
    {
      cycle: "revenge_spiral",
      active: revengeSpiral,
      severity: revengeSpiral ? 85 : 12,
      narrative: revengeSpiral
        ? "Revenge spiral active — losses clustering with impulsive tags."
        : "No revenge spiral in recent sample.",
      predictedInstabilityDays: revengeSpiral ? 1 : null,
    },
    {
      cycle: "discipline_streak",
      active: disciplineStreak,
      severity: disciplineStreak ? 20 : 40,
      narrative: disciplineStreak
        ? "Discipline streak — protect it; do not size up from euphoria."
        : "Discipline streak not established — one clean trade builds it.",
      predictedInstabilityDays: null,
    },
    {
      cycle: "emotional_recovery",
      active: recoverySpeed >= 70,
      severity: 100 - recoverySpeed,
      narrative: `Emotional recovery speed ~${recoverySpeed}/100 after setbacks.`,
      predictedInstabilityDays: recoverySpeed < 50 ? 4 : null,
    },
  ]

  const activeCycles = cycles.filter((c) => c.active && c.severity >= 60)
  const instabilityRisk = clamp(
    activeCycles.reduce((s, c) => s + c.severity, 0) / Math.max(1, activeCycles.length) ||
      context.tradingOs?.liveSession.emotionalDriftScore ||
      25,
  )

  const narrative =
    activeCycles.length > 0
      ? `Watch: ${activeCycles.map((c) => c.cycle.replace(/_/g, " ")).join(", ")}. Instability risk ~${instabilityRisk}%.`
      : "Behavioral cycles stable — maintain process."

  return {
    cycles,
    instabilityRisk,
    recoverySpeed,
    narrative,
  }
}
