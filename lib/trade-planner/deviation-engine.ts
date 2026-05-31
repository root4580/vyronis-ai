import { calculateRiskReward } from "@/lib/trade-form-utils"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"

export type DeviationSeverity = "green" | "amber" | "red" | "na"

export type FieldDeviation = {
  field: string
  planned: string
  actual: string
  severity: DeviationSeverity
  deviationPercent: number | null
  note: string
}

export type PlanDisciplineGrade = "A" | "B" | "C" | "D"

export type PlanDisciplineResult = {
  score: number
  grade: PlanDisciplineGrade
  fields: FieldDeviation[]
  worstDeviations: FieldDeviation[]
}

export type TradeActualForDeviation = {
  pair: string
  direction: string
  entryPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  lots: number | null
  riskPercent: number | null
  riskReward: number | null
  /** Derived from account size × risk % when lots are not logged. */
  riskAmount: number | null
}

function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return String(value)
}

function formatLots(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return value.toFixed(2)
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `$${value.toFixed(2)}`
}

function formatRr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${value.toFixed(2)}R`
}

function severityFromPercent(percent: number): DeviationSeverity {
  if (percent <= 10) return "green"
  if (percent <= 25) return "amber"
  return "red"
}

function numericDeviationPercent(planned: number, actual: number): number {
  if (!Number.isFinite(planned) || !Number.isFinite(actual)) return 0
  if (planned === 0) return actual === 0 ? 0 : 100
  return (Math.abs(actual - planned) / Math.abs(planned)) * 100
}

function compareNumericField(
  field: string,
  planned: number | null | undefined,
  actual: number | null | undefined,
  format: (value: number | null | undefined) => string,
  alignedNote: string,
  amberNote: string,
  redNote: string,
): FieldDeviation {
  if (planned == null || !Number.isFinite(planned) || actual == null || !Number.isFinite(actual)) {
    return {
      field,
      planned: format(planned ?? null),
      actual: format(actual ?? null),
      severity: "na",
      deviationPercent: null,
      note: actual == null || !Number.isFinite(actual) ? "Not logged on trade." : "No planned value.",
    }
  }

  const deviationPercent = numericDeviationPercent(planned, actual)
  const severity = severityFromPercent(deviationPercent)

  return {
    field,
    planned: format(planned),
    actual: format(actual),
    severity,
    deviationPercent,
    note: severity === "green" ? alignedNote : severity === "amber" ? amberNote : redNote,
  }
}

function compareDirection(
  planned: string,
  actual: string,
): FieldDeviation {
  const aligned = planned.trim().toUpperCase() === actual.trim().toUpperCase()
  return {
    field: "Direction",
    planned: planned.toUpperCase(),
    actual: actual.toUpperCase(),
    severity: aligned ? "green" : "red",
    deviationPercent: aligned ? 0 : 100,
    note: aligned ? "Direction matched your plan." : "Direction differed from your plan.",
  }
}

function scorePenalty(severity: DeviationSeverity, field: string): number {
  if (severity === "na" || severity === "green") return 0
  if (field === "Direction") return 25
  if (severity === "amber") return 5
  return 15
}

function gradeFromScore(score: number): PlanDisciplineGrade {
  if (score >= 80) return "A"
  if (score >= 60) return "B"
  if (score >= 40) return "C"
  return "D"
}

export function buildTradeActualForDeviation(input: {
  pair: string
  direction: string
  entryPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  lots?: number | null
  riskPercent?: number | null
  riskReward?: number | null
  startingBalance?: number | null
  accountSizeForRisk?: number | null
}): TradeActualForDeviation {
  const riskPercent = input.riskPercent ?? null
  const balanceForRisk = input.accountSizeForRisk ?? input.startingBalance ?? null
  const riskAmount =
    riskPercent != null &&
    balanceForRisk != null &&
    Number.isFinite(balanceForRisk) &&
    Number.isFinite(riskPercent)
      ? (balanceForRisk * riskPercent) / 100
      : null

  const derivedRr =
    input.riskReward ??
    calculateRiskReward({
      direction: input.direction,
      entry_price: input.entryPrice?.toString() ?? "",
      stop_loss: input.stopLoss?.toString() ?? "",
      take_profit: input.takeProfit?.toString() ?? "",
    })

  return {
    pair: input.pair,
    direction: input.direction,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    lots: input.lots ?? null,
    riskPercent,
    riskReward: derivedRr,
    riskAmount,
  }
}

export function computePlanDiscipline(
  plan: MatchableTradePlan,
  actual: TradeActualForDeviation,
): PlanDisciplineResult {
  const fields: FieldDeviation[] = [
    compareNumericField(
      "Entry price",
      plan.entryPrice,
      actual.entryPrice,
      formatPrice,
      "Entry matched your plan.",
      "Entry slightly off plan.",
      "Entry deviated significantly from plan.",
    ),
    compareNumericField(
      "Stop loss",
      plan.stopLoss,
      actual.stopLoss,
      formatPrice,
      "Stop loss matched your plan.",
      "Stop loss slightly off plan.",
      "Stop loss deviated significantly from plan.",
    ),
    compareNumericField(
      "Take profit",
      plan.takeProfit,
      actual.takeProfit,
      formatPrice,
      "Take profit matched your plan.",
      "Take profit slightly off plan.",
      "Take profit deviated significantly from plan.",
    ),
    compareNumericField(
      "Lot size",
      plan.recommendedLots,
      actual.lots,
      formatLots,
      "Lot size matched your plan.",
      "Lot size slightly off plan.",
      "Lot size deviated significantly from plan.",
    ),
    compareNumericField(
      "Risk $",
      plan.riskAmount,
      actual.riskAmount,
      formatMoney,
      "Risk amount matched your plan.",
      "Risk amount slightly off plan.",
      "Risk amount deviated significantly from plan.",
    ),
    compareNumericField(
      "R:R",
      plan.rr,
      actual.riskReward,
      formatRr,
      "R:R matched your plan.",
      "R:R slightly off plan.",
      "R:R deviated significantly from plan.",
    ),
    compareDirection(plan.direction, actual.direction),
  ]

  let score = 100
  for (const field of fields) {
    score -= scorePenalty(field.severity, field.field)
  }
  score = Math.max(0, Math.min(100, score))

  const worstDeviations = [...fields]
    .filter((field) => field.severity === "red" || field.severity === "amber")
    .sort((a, b) => (b.deviationPercent ?? 0) - (a.deviationPercent ?? 0))
    .slice(0, 3)

  return {
    score,
    grade: gradeFromScore(score),
    fields,
    worstDeviations,
  }
}

export function disciplineGradeLabel(grade: PlanDisciplineGrade): string {
  switch (grade) {
    case "A":
      return "Strong discipline"
    case "B":
      return "Minor deviations"
    case "C":
      return "Plan drift"
    default:
      return "Off plan"
  }
}
