import { sanitizeCoachLanguage } from "@/lib/coach-chapters/personality"

export type CoachVerdictLabel = "READY" | "PATIENCE" | "NOT YET"

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
      label: "READY",
      tone: "profit",
      description: sanitizeCoachLanguage(
        "This is what you've been waiting for. All filters aligned — trust your analysis and execute the plan.",
      ),
    }
  }
  if (rec === "CAUTION") {
    return {
      label: "PATIENCE",
      tone: "amber",
      description: sanitizeCoachLanguage(
        "This setup has potential but isn't quite there yet. Wait for the full confirmation.",
      ),
    }
  }
  if (rec === "SKIP") {
    return {
      label: "NOT YET",
      tone: "amber",
      description: sanitizeCoachLanguage(
        "Not today — protect your chapter. A better setup is coming.",
      ),
    }
  }

  if (input.shouldTakeTrade === "yes") {
    return {
      label: "READY",
      tone: "profit",
      description: sanitizeCoachLanguage(
        "Aligned with your process — execute the plan with discipline.",
      ),
    }
  }
  if (input.shouldTakeTrade === "caution") {
    return {
      label: "PATIENCE",
      tone: "amber",
      description: sanitizeCoachLanguage(
        "Wait for the full confirmation. The best traders miss setups on purpose.",
      ),
    }
  }
  if (input.shouldTakeTrade === "no") {
    return {
      label: "NOT YET",
      tone: "amber",
      description: sanitizeCoachLanguage(
        "Your edge is built on patience. This one needs more time.",
      ),
    }
  }

  return null
}

export function coachVerdictClassName(tone: CoachVerdictDisplay["tone"]): string {
  if (tone === "profit") return "border-profit/35 bg-profit/[0.12] text-profit"
  if (tone === "amber") return "border-warning/35 bg-warning/[0.12] text-warning-foreground"
  return "border-violet-400/30 bg-violet-500/[0.1] text-violet-100"
}
