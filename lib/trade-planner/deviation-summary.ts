import type { PlanDisciplineResult } from "@/lib/trade-planner/deviation-engine"

const FIELD_SHORT: Record<string, string> = {
  "Entry price": "Entry",
  "Stop loss": "SL",
  "Take profit": "TP",
  "Lot size": "Lots",
  "Risk $": "Risk",
  "R:R": "R:R",
  Direction: "Direction",
}

function shortDeviationLabel(field: string, severity: "green" | "amber" | "red" | "na"): string {
  const short = FIELD_SHORT[field] ?? field
  if (severity === "green" || severity === "na") return `${short} held`
  if (severity === "amber") return `${short} slightly off`
  return `${short} off plan`
}

/** One-line deviation summary for journal trade cards. */
export function formatPlanDeviationSummary(result: PlanDisciplineResult): string {
  const deviations = result.worstDeviations.filter((field) => field.severity !== "na")
  if (deviations.length === 0) {
    return "Plan followed"
  }
  return deviations
    .slice(0, 3)
    .map((field) => shortDeviationLabel(field.field, field.severity))
    .join(" · ")
}
