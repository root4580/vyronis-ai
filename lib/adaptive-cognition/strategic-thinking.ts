import type { AdaptiveCognitionInput, StrategicGuidance, StrategicThinkingSnapshot } from "@/lib/adaptive-cognition/types"

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function buildStrategicThinking(input: AdaptiveCognitionInput): StrategicThinkingSnapshot {
  const { context } = input
  const items: StrategicGuidance[] = []
  const maturity = input.context.tradingOs?.evolution.overallEvolutionScore ?? 50
  const drawdown = context.risk.todayLossPercent
  const limit = context.settings.daily_drawdown_limit

  const capitalPreservationScore = clamp(
    100 - drawdown * (100 / Math.max(limit, 1)) - (context.tradingOs?.intervention.active ? 20 : 0),
  )

  if (drawdown >= limit * 0.6) {
    items.push({
      area: "capital_preservation",
      headline: "Preserve capital first",
      guidance: "No risk expansion until drawdown recovers — survival is the strategy.",
      priority: "high",
    })
  }

  if (maturity >= 70 && capitalPreservationScore >= 65) {
    items.push({
      area: "scaling",
      headline: "Scaling readiness",
      guidance:
        "Process maturity is rising — scale only with rule adherence, not win streak euphoria.",
      priority: "medium",
    })
  } else {
    items.push({
      area: "consistency_milestones",
      headline: "Consistency before scale",
      guidance: "Hit 10 disciplined trades in a row before increasing size or accounts.",
      priority: "high",
    })
  }

  items.push({
    area: "account_management",
    headline: "Account hygiene",
    guidance: `Prop context: ${context.settings.prop_firm_size ?? "personal"} — treat daily limit ${context.settings.max_trades_per_day} trades as hard law.`,
    priority: "medium",
  })

  if (context.tradingOs?.strategy.sessionEdge[0]) {
    items.push({
      area: "risk_expansion",
      headline: "Where to expand risk",
      guidance: `Only add size in ${context.tradingOs.strategy.sessionEdge[0].session} when setup grade is A+.`,
      priority: "low",
    })
  }

  const consistencyMilestone =
    maturity >= 80
      ? "Approaching operator-grade consistency"
      : maturity >= 60
        ? "Building reliable process — stay patient"
        : "Foundation phase — journal every trade"

  return {
    items: items.slice(0, 5),
    capitalPreservationScore,
    consistencyMilestone,
  }
}
