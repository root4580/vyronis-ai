import {
  allowHistoricalStandDown,
  getContextTodayTrades,
  isFreshTradingDay,
} from "@/lib/intelligence/trading-day-boundary"
import type {
  AutonomousIntervention,
  LiveSessionMonitoring,
  TradingOsEngineInput,
} from "@/lib/trading-os/types"

function countLowQualityStreak(context: TradingOsEngineInput["context"]): number {
  const todayTrades = getContextTodayTrades(context)
  if (todayTrades.length === 0) return 0

  let streak = 0
  for (const t of todayTrades.slice(0, 5)) {
    const impulsive = /fomo|revenge|anxious|euphoric|tilted|impulsive/i.test(t.emotion || "")
    const bad = t.result === "LOSS" || t.rule_followed === false || impulsive
    if (bad) streak += 1
    else break
  }
  return streak
}

export function evaluateAutonomousIntervention(input: {
  os: TradingOsEngineInput
  liveSession: LiveSessionMonitoring
}): AutonomousIntervention {
  const { context } = input.os
  const { liveSession } = input
  const shadow = context.autonomous?.shadow
  const cognitive = context.cognitive
  const lowQualityStreak = countLowQualityStreak(context)
  const freshDay = isFreshTradingDay(context)
  const historicalStandDown = allowHistoricalStandDown(context)

  const actions: AutonomousIntervention["actions"] = []
  let severity: AutonomousIntervention["severity"] = "info"
  let active = false
  let canProceedToEntry = true
  let headline = "Monitoring — no intervention required"
  let message = "Conditions within your operating guardrails. Trade your playbook."
  let reflectionPrompt: string | null = null
  let suggestedRiskMultiplier = 1
  let expiresAfterMinutes: number | null = null

  const shadowPause = Boolean(shadow?.shouldPause && historicalStandDown)
  const standDown =
    liveSession.overtradingLevel === "critical" ||
    shadowPause ||
    context.risk.todayLossPercent >= context.settings.daily_drawdown_limit

  if (standDown) {
    active = true
    severity = "critical"
    canProceedToEntry = false
    actions.push("stand_down", "block_impulsive_confirmation")
    headline = "Pause — protect capital and process"
    message =
      (shadowPause ? shadow?.proactiveMessage : null) ??
      "Daily limits or drawdown guard are in play. Step away until you have a clear, calm plan."
    reflectionPrompt = "What emotion is driving the urge to trade right now? One honest sentence before you return."
    suggestedRiskMultiplier = 0
    expiresAfterMinutes = 60
  } else if (lowQualityStreak >= 3) {
    active = true
    severity = "critical"
    canProceedToEntry = false
    actions.push("require_reflection", "block_impulsive_confirmation", "stand_down")
    headline = "Process break — reset first"
    message = `Last ${lowQualityStreak} executions showed process slippage. A short reset will sharpen the next decision.`
    reflectionPrompt =
      "Name the pattern (revenge, FOMO, boredom). What is one rule you will follow on the next trade?"
    suggestedRiskMultiplier = 0
    expiresAfterMinutes = 30
  } else if (
    !freshDay &&
    (liveSession.overtradingLevel === "high" ||
      liveSession.emotionalDriftScore >= 70 ||
      shadow?.overallRiskLevel === "critical")
  ) {
    active = true
    severity = "warning"
    canProceedToEntry = true
    actions.push("reduce_size", "require_reflection")
    headline = "Risk elevated — reduce size"
    message =
      cognitive?.coaching.headline ??
      "Emotional or overtrading risk is high. Half size minimum; confirm checklist twice."
    reflectionPrompt = "What would make this trade A+ process — not just a win?"
    suggestedRiskMultiplier = 0.5
    expiresAfterMinutes = 20
  } else if (
    lowQualityStreak >= 2 ||
    (!freshDay &&
      (shadow?.overallRiskLevel === "elevated" || liveSession.emotionalDriftScore >= 55))
  ) {
    active = true
    severity = "warning"
    actions.push("reduce_size")
    headline = "Caution — tighten execution"
    message = "Two recent trades show process slippage. Reduce size and wait for confirmation."
    suggestedRiskMultiplier = 0.65
    expiresAfterMinutes = 15
  } else if (
    historicalStandDown &&
    (cognitive?.state.primary === "revenge_driven" || cognitive?.state.primary === "impulsive")
  ) {
    active = true
    severity = "warning"
    canProceedToEntry = false
    actions.push("block_impulsive_confirmation", "require_reflection")
    headline = "Impulse guard — slow down"
    message = `State reads ${cognitive.state.primary.replace(/_/g, " ")}. A few minutes of reflection will protect execution quality.`
    reflectionPrompt = cognitive.state.narrative
    suggestedRiskMultiplier = 0
    expiresAfterMinutes = 10
  }

  return {
    id: active ? `intervention-${severity}` : "intervention-clear",
    active,
    severity,
    actions,
    headline,
    message,
    canProceedToEntry,
    reflectionPrompt,
    suggestedRiskMultiplier,
    expiresAfterMinutes,
  }
}
