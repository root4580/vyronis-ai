import type { TradeQualityGrade } from "@/lib/trade-coach/trade-quality-engine"

export function gradeFromTechnicalScore(score: number): TradeQualityGrade {
  if (score >= 82) return "A"
  if (score >= 68) return "B"
  if (score >= 52) return "C"
  if (score >= 35) return "D"
  return "F"
}

export function gradeTone(grade: TradeQualityGrade): "profit" | "amber" | "loss" | "muted" {
  if (grade === "A" || grade === "B") return "profit"
  if (grade === "C") return "amber"
  if (grade === "D") return "loss"
  return "muted"
}

export const GRADE_TONE_CLASSES: Record<
  ReturnType<typeof gradeTone>,
  string
> = {
  profit: "border-profit/30 bg-profit/[0.1] text-profit",
  amber: "border-warning/30 bg-warning/[0.1] text-warning-foreground",
  loss: "border-loss/30 bg-loss/[0.1] text-loss",
  muted: "border-white/[0.1] bg-white/[0.04] text-muted-foreground/80",
}
