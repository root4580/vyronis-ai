import type { LiveTradeCompanionSnapshot, TradingOsEngineInput } from "@/lib/trading-os/types"

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function buildLiveTradeCompanion(input: TradingOsEngineInput): LiveTradeCompanionSnapshot {
  const { context } = input
  const planned = context.activePlannedContext
  const shadow = context.autonomous?.shadow
  const cognitive = context.cognitive

  if (!planned?.pair && !input.focusTradeId) {
    return {
      active: false,
      tradeLabel: null,
      executionQuality: shadow?.executionQualityPrediction ?? 55,
      emotionalEscalation: shadow?.emotionalRiskScore ?? 30,
      panicManagementRisk: 20,
      ruleDeviationFlags: [],
      liveNarrative: "No active planned trade — companion idle until you open a setup.",
      coachingLine: "Upload a chart or open pre-trade coach to activate live monitoring.",
    }
  }

  const tradeLabel = planned
    ? `${planned.pair} ${planned.direction ?? ""}`.trim()
    : "Active trade"

  const emotion = String(planned?.emotion || cognitive?.state.primary || "").toLowerCase()
  const impulsive = /fomo|revenge|anxious|euphoric|tilted|impulsive/.test(emotion)

  const executionQuality = clamp(
    shadow?.executionQualityPrediction ??
      planned?.vision_score ??
      planned?.entry_confirmation_score ??
      55,
  )

  const emotionalEscalation = clamp(
    shadow?.emotionalRiskScore ??
      (impulsive ? 75 : cognitive?.state.primary === "calm" ? 25 : 45),
  )

  const panicManagementRisk = clamp(
    impulsive && context.emotionalState.trend === "volatile"
      ? 82
      : impulsive
        ? 60
        : context.risk.todayLossPercent >= context.settings.daily_drawdown_limit * 0.6
          ? 55
          : 22,
  )

  const ruleDeviationFlags: string[] = []
  if (planned && planned.risk_percent != null) {
    const plannedRisk = Number(planned.risk_percent)
    const max = context.settings.max_risk_per_trade
    if (Number.isFinite(plannedRisk) && plannedRisk > max) {
      ruleDeviationFlags.push(`Risk ${plannedRisk}% exceeds max ${max}%`)
    }
  }
  if (impulsive) ruleDeviationFlags.push("Impulsive emotion tag on planned entry")
  if (context.memory.snapshot.todayTradeCount >= context.settings.max_trades_per_day) {
    ruleDeviationFlags.push("At or over daily trade count limit")
  }

  const liveNarrative = [
    `Monitoring ${tradeLabel}.`,
    executionQuality >= 65
      ? "Execution quality forecast is acceptable — stay with plan."
      : "Execution quality soft — tighten confirmation before click.",
    emotionalEscalation >= 60
      ? "Emotional escalation rising — watch for panic management."
      : "Emotional lane stable.",
  ].join(" ")

  const coachingLine =
    panicManagementRisk >= 60
      ? "Hands off the mouse for 30s — breathe, then re-check SL and size."
      : ruleDeviationFlags.length > 0
        ? `Rule check: ${ruleDeviationFlags[0]}`
        : cognitive?.coaching.headline ?? "Stay with planned entry and exit rules."

  return {
    active: true,
    tradeLabel,
    executionQuality,
    emotionalEscalation,
    panicManagementRisk,
    ruleDeviationFlags,
    liveNarrative,
    coachingLine,
  }
}
