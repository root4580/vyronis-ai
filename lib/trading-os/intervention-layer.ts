import type {
  AutonomousIntervention,
  LiveSessionMonitoring,
  TradingOsEngineInput,
} from "@/lib/trading-os/types"

function countLowQualityStreak(context: TradingOsEngineInput["context"]): number {
  let streak = 0
  for (const t of context.recentTrades.slice(0, 5)) {
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

  const actions: AutonomousIntervention["actions"] = []
  let severity: AutonomousIntervention["severity"] = "info"
  let active = false
  let canProceedToEntry = true
  let headline = "Monitoring — no intervention required"
  let message = "Conditions within your operating guardrails. Trade your playbook."
  let reflectionPrompt: string | null = null
  let suggestedRiskMultiplier = 1
  let expiresAfterMinutes: number | null = null

  const standDown =
    liveSession.overtradingLevel === "critical" ||
    shadow?.shouldPause ||
    context.risk.todayLossPercent >= context.settings.daily_drawdown_limit

  if (standDown) {
    active = true
    severity = "critical"
    canProceedToEntry = false
    actions.push("stand_down", "block_impulsive_confirmation")
    headline = "Stand down — capital protection"
    message =
      shadow?.proactiveMessage ??
      "Daily limits or drawdown guard triggered. No new executions until you reset."
    reflectionPrompt = "What emotion is driving the urge to trade right now? Write one sentence before returning."
    suggestedRiskMultiplier = 0
    expiresAfterMinutes = 60
  } else if (lowQualityStreak >= 3) {
    active = true
    severity = "critical"
    canProceedToEntry = false
    actions.push("require_reflection", "block_impulsive_confirmation", "stand_down")
    headline = "Process break — pause required"
    message = `You've entered ${lowQualityStreak} lower-quality setups in a row. Pause before next execution.`
    reflectionPrompt =
      "Name the pattern (revenge, FOMO, boredom). What is one rule you will follow on the next trade?"
    suggestedRiskMultiplier = 0
    expiresAfterMinutes = 30
  } else if (
    liveSession.overtradingLevel === "high" ||
    liveSession.emotionalDriftScore >= 70 ||
    shadow?.overallRiskLevel === "critical"
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
    shadow?.overallRiskLevel === "elevated" ||
    liveSession.emotionalDriftScore >= 55
  ) {
    active = true
    severity = "warning"
    actions.push("reduce_size")
    headline = "Caution — tighten execution"
    message = "Two recent trades show process slippage. Reduce size and wait for confirmation."
    suggestedRiskMultiplier = 0.65
    expiresAfterMinutes = 15
  } else if (cognitive?.state.primary === "revenge_driven" || cognitive?.state.primary === "impulsive") {
    active = true
    severity = "warning"
    canProceedToEntry = false
    actions.push("block_impulsive_confirmation", "require_reflection")
    headline = "Impulse guard active"
    message = `Trader state is ${cognitive.state.primary.replace(/_/g, " ")} — reflection required before entry.`
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
