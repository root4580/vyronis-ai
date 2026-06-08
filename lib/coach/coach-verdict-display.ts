import { sanitizeCoachLanguage } from "@/lib/coach-chapters/personality"

export type CoachVerdictLabel =
  | "A+ READY"
  | "WAIT FOR CONFIRMATION"
  | "SKIP TRADE"
  | "READY"
  | "PATIENCE"
  | "NOT YET"

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
      label: "A+ READY",
      tone: "profit",
      description: sanitizeCoachLanguage(
        "All rules satisfied. Setup and entry triggers are complete — execute the plan.",
      ),
    }
  }
  if (rec === "CAUTION") {
    return {
      label: "WAIT FOR CONFIRMATION",
      tone: "amber",
      description: sanitizeCoachLanguage(
        "Setup quality may be strong, but entry triggers are incomplete. Wait for confirmation.",
      ),
    }
  }
  if (rec === "SKIP") {
    return {
      label: "SKIP TRADE",
      tone: "loss",
      description: sanitizeCoachLanguage(
        "Playbook rules violated or setup quality too low — protect the chapter.",
      ),
    }
  }

  if (input.shouldTakeTrade === "yes") {
    return {
      label: "A+ READY",
      tone: "profit",
      description: sanitizeCoachLanguage(
        "All rules satisfied — setup and entry are aligned. Execute the plan with discipline.",
      ),
    }
  }
  if (input.shouldTakeTrade === "caution") {
    return {
      label: "WAIT FOR CONFIRMATION",
      tone: "amber",
      description: sanitizeCoachLanguage(
        "Valid setup, incomplete entry. The best traders miss setups on purpose.",
      ),
    }
  }
  if (input.shouldTakeTrade === "no") {
    return {
      label: "SKIP TRADE",
      tone: "loss",
      description: sanitizeCoachLanguage(
        "Not an A+ entry today — stand down and wait for a cleaner read.",
      ),
    }
  }

  return null
}

export function coachVerdictClassName(tone: CoachVerdictDisplay["tone"]): string {
  if (tone === "profit") return "border-profit/35 bg-profit/[0.12] text-profit"
  if (tone === "amber") return "border-warning/35 bg-warning/[0.12] text-warning-foreground"
  return "border-loss/35 bg-loss/[0.12] text-loss"
}
