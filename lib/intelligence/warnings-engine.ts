import type { CommandCenterWarning } from "@/lib/command-center/types"
import type { PrimaryLeakInsight } from "@/lib/behavior/types"
import type { PatternMemoryPattern } from "@/lib/trade-coach/pattern-memory"
import type { PlannedCoachSessionItem } from "@/lib/trade-coach/types"

export function buildBehavioralWarnings(input: {
  primaryLeak: PrimaryLeakInsight
  patterns: PatternMemoryPattern[]
  plannedSessions: PlannedCoachSessionItem[]
  todayTradeCount: number
  maxTradesPerDay: number
}): CommandCenterWarning[] {
  const warnings: CommandCenterWarning[] = []

  if (input.primaryLeak.status === "active") {
    warnings.push({
      id: `leak-${input.primaryLeak.id}`,
      severity: "warning",
      title: "Primary behavioral leak",
      message: input.primaryLeak.correctiveAction,
      source: "leak",
    })
  }

  const criticalPattern = input.patterns.find((p) => p.severity === "warning")
  if (criticalPattern) {
    warnings.push({
      id: `pattern-${criticalPattern.id}`,
      severity: "warning",
      title: "Pattern detected",
      message: criticalPattern.message,
      source: "pattern",
    })
  }

  if (input.todayTradeCount >= input.maxTradesPerDay) {
    warnings.push({
      id: "risk-max-trades",
      severity: "critical",
      title: "Daily trade limit reached",
      message: `You've logged ${input.todayTradeCount} trades today (max ${input.maxTradesPerDay}). Consider standing down.`,
      source: "risk",
    })
  }

  const inProgressPlans = input.plannedSessions.filter((s) => s.status === "in_progress")
  if (inProgressPlans.length > 0) {
    const plan = inProgressPlans[0]
    warnings.push({
      id: `planned-${plan.id}`,
      severity: "info",
      title: "Open planned setup",
      message: `${plan.pair || "Setup"} ${plan.direction || ""} is waiting for your pre-trade review.`,
      source: "planned",
    })
  }

  return warnings.slice(0, 3)
}
