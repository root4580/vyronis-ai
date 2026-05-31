export type CoachVerdictLabel = "EXECUTE" | "CAUTION" | "SKIP"

export type CoachVerdictDisplay = {
  label: CoachVerdictLabel
  tone: "profit" | "amber" | "loss"
  description: string
}

export function mapCoachVerdict(input: {
  shouldTakeTrade?: "yes" | "caution" | "no" | null
  recommendation?: string | null
}): CoachVerdictDisplay | null {
  const rec = input.recommendation?.toUpperCase()
  if (rec === "TAKE" || rec === "EXECUTE") {
    return {
      label: "EXECUTE",
      tone: "profit",
      description: "Setup meets your process gates — proceed with discipline.",
    }
  }
  if (rec === "CAUTION") {
    return {
      label: "CAUTION",
      tone: "amber",
      description: "Borderline setup — reduce size or wait for confirmation.",
    }
  }
  if (rec === "SKIP") {
    return {
      label: "SKIP",
      tone: "loss",
      description: "Process or psychology blockers — stand down for now.",
    }
  }

  if (input.shouldTakeTrade === "yes") {
    return {
      label: "EXECUTE",
      tone: "profit",
      description: "Setup meets your process gates — proceed with discipline.",
    }
  }
  if (input.shouldTakeTrade === "caution") {
    return {
      label: "CAUTION",
      tone: "amber",
      description: "Borderline setup — reduce size or wait for confirmation.",
    }
  }
  if (input.shouldTakeTrade === "no") {
    return {
      label: "SKIP",
      tone: "loss",
      description: "Process or psychology blockers — stand down for now.",
    }
  }

  return null
}

export function coachVerdictClassName(tone: CoachVerdictDisplay["tone"]): string {
  if (tone === "profit") return "border-profit/35 bg-profit/[0.12] text-profit"
  if (tone === "amber") return "border-amber-500/35 bg-amber-500/[0.12] text-amber-300"
  return "border-loss/35 bg-loss/[0.12] text-loss"
}
