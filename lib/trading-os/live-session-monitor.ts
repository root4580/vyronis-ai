import { isFreshTradingDay, isHistoricalCautionOnly } from "@/lib/intelligence/trading-day-boundary"
import { detectTradingSession } from "@/lib/trading/session-timing"
import type {
  LiveSessionAlert,
  LiveSessionMonitoring,
  TradingOsEngineInput,
} from "@/lib/trading-os/types"

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function monitorLiveSession(input: TradingOsEngineInput): LiveSessionMonitoring {
  const { context, lastKnownSession } = input
  const session = detectTradingSession()
  const alerts: LiveSessionAlert[] = []
  const now = new Date().toISOString()

  const todayCount = context.memory.snapshot.todayTradeCount
  const maxTrades = context.settings.max_trades_per_day
  const shadow = context.autonomous?.shadow
  const cognitive = context.cognitive
  const recovery = context.sessionRecovery
  const freshDay = isFreshTradingDay(context)
  const historicalOnly = isHistoricalCautionOnly(context)

  const volatilityState: LiveSessionMonitoring["volatilityState"] =
    cognitive?.marketEnvironment.labels.includes("expanding_volatility")
      ? "expanded"
      : cognitive?.marketEnvironment.labels.includes("compression")
        ? "compressed"
        : cognitive?.marketEnvironment.primary === "choppy"
          ? "expanded"
          : "normal"

  let overtradingLevel: LiveSessionMonitoring["overtradingLevel"] = "low"
  const overProb = shadow?.overtradingProbability ?? cognitive?.predictions.overtradingProbability ?? 0
  if (todayCount >= maxTrades) overtradingLevel = "critical"
  else if (todayCount >= maxTrades - 1) overtradingLevel = "high"
  else if (!freshDay && (overProb >= 70 || todayCount >= Math.max(2, maxTrades - 2))) {
    overtradingLevel = "high"
  } else if (!freshDay && overProb >= 45) {
    overtradingLevel = "moderate"
  }

  let emotionalDriftScore = clamp(
    context.sessionRecovery?.adjustedEmotionalRisk ??
      shadow?.emotionalRiskScore ??
      (context.emotionalState.trend === "volatile"
        ? 78
        : context.emotionalState.trend === "elevated"
          ? 58
          : 28),
  )
  if (freshDay && historicalOnly) {
    emotionalDriftScore = Math.min(emotionalDriftScore, 58)
  }

  const emotionalDriftNarrative =
    recovery?.probabilityNarrative ??
    (context.emotionalState.trend === "volatile"
      ? "Emotional drift is elevated — impulse risk rising through the session."
      : context.emotionalState.trend === "elevated"
        ? "Mild emotional drift — stay with playbook rules."
        : "Emotional baseline stable so far today.")

  const sessionTransitionPending = Boolean(
    lastKnownSession && lastKnownSession !== session.name && session.isActive,
  )

  if (sessionTransitionPending) {
    alerts.push({
      id: "session-transition",
      severity: "info",
      category: "session_transition",
      message: `Session shift: ${lastKnownSession} → ${session.name}. Re-check bias and size.`,
      actionHint: "Pause 2 minutes and re-read your session playbook.",
      createdAt: now,
    })
  }

  if (volatilityState === "expanded") {
    alerts.push({
      id: "vol-expanded",
      severity: "warning",
      category: "volatility_shift",
      message: "Volatility expanding — widen stops or reduce size; avoid chasing.",
      actionHint: "Cut risk 25–50% until structure clarifies.",
      createdAt: now,
    })
  }

  if (overtradingLevel === "critical" || overtradingLevel === "high") {
    alerts.push({
      id: "overtrade-escalation",
      severity: overtradingLevel === "critical" ? "critical" : "warning",
      category: "overtrading",
      message:
        overtradingLevel === "critical"
          ? `Daily trade cap reached (${todayCount}/${maxTrades}). Further entries are overtrading by definition.`
          : `Overtrading risk elevated — ${todayCount} trades today, limit ${maxTrades}.`,
      actionHint: "Stand down or journal before the next click.",
      createdAt: now,
    })
  }

  if (emotionalDriftScore >= 65 && !(freshDay && historicalOnly && emotionalDriftScore < 72)) {
    alerts.push({
      id: "emotional-drift",
      severity: emotionalDriftScore >= 80 && !freshDay ? "critical" : "warning",
      category: "emotional_drift",
      message: emotionalDriftNarrative,
      actionHint: "Run a 60-second reset before confirming any entry.",
      createdAt: now,
    })
  }

  if (context.risk.todayLossPercent >= context.settings.daily_drawdown_limit * 0.75) {
    alerts.push({
      id: "drawdown-proximity",
      severity: "critical",
      category: "drawdown",
      message: `Drawdown at ${context.risk.todayLossPercent.toFixed(1)}% — near ${context.settings.daily_drawdown_limit}% limit.`,
      actionHint: "Protect capital — next trade should be half size or none.",
      createdAt: now,
    })
  }

  if (shadow?.disciplineDrift && shadow.disciplineDrift >= 50) {
    alerts.push({
      id: "discipline-drift",
      severity: "warning",
      category: "discipline",
      message: "Discipline drift detected vs your recent process wins.",
      actionHint: "Re-read today's plan; no impulsive confirmations.",
      createdAt: now,
    })
  }

  return {
    activeSession: session.name,
    sessionIsActive: session.isActive,
    previousSession: lastKnownSession ?? null,
    sessionTransitionPending,
    volatilityState,
    overtradingLevel,
    emotionalDriftScore,
    emotionalDriftNarrative,
    alerts: alerts.slice(0, 6),
    monitoringActive: session.isActive || todayCount > 0,
  }
}
