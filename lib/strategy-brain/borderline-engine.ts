import type { SetupGrade, TradeRecommendation } from "@/lib/strategy-brain/types"

export const BORDERLINE_AUTO_SKIP_THRESHOLD = 2

export function evaluateBorderlineRecommendation(input: {
  borderlineCount: number
  grade: SetupGrade
  setupValid: boolean
  directionalPermission: boolean
}): { recommendation: TradeRecommendation; reason: string } {
  const { borderlineCount, grade, setupValid, directionalPermission } = input

  if (!setupValid) {
    return {
      recommendation: "SKIP",
      reason: "HTF layers conflict — no discretionary entry until bias realigns.",
    }
  }

  if (borderlineCount >= BORDERLINE_AUTO_SKIP_THRESHOLD) {
    return {
      recommendation: "SKIP",
      reason: `${borderlineCount} conditions are borderline — auto-recommend pause until clarity improves.`,
    }
  }

  if (!directionalPermission) {
    return {
      recommendation: "CAUTION",
      reason: "HTF not fully aligned — only consider reduced-risk plans with strict confirmation.",
    }
  }

  if (grade === "A+") {
    return {
      recommendation: "TAKE",
      reason: "A+ process score — execute your plan with discipline.",
    }
  }

  if (grade === "B") {
    return {
      recommendation: "CAUTION",
      reason: "Solid B setup — confirm trigger and size down if any layer softens.",
    }
  }

  return {
    recommendation: "SKIP",
    reason: "Grade below actionable threshold — patience is the edge.",
  }
}
