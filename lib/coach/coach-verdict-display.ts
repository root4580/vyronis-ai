import { sanitizeCoachLanguage } from "@/lib/coach-chapters/personality"

export type CoachVerdictLabel =
  | "A+ READY"
  | "WAIT FOR CONFIRMATION"
  | "SKIP TRADE"
  | "TRADE LIMIT REACHED"
  | "COACH WARNING"
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

export function mapCoachFinalVerdictDisplay(
  verdict: import("@/lib/coach/coach-execution-verdict").CoachFinalVerdict,
): CoachVerdictDisplay {
  if (verdict === "A_PLUS_READY") {
    return {
      label: "A+ READY",
      tone: "profit",
      description: sanitizeCoachLanguage(
        "All entry gate rules satisfied — execute the plan with discipline.",
      ),
    }
  }
  if (verdict === "WAIT_FOR_CONFIRMATION") {
    return {
      label: "WAIT FOR CONFIRMATION",
      tone: "amber",
      description: sanitizeCoachLanguage(
        "Setup may be strong, but a required entry gate rule is still open.",
      ),
    }
  }
  if (verdict === "COACH_WARNING") {
    return {
      label: "COACH WARNING",
      tone: "amber",
      description: sanitizeCoachLanguage(
        "Technical gate passed — fix mindset before sizing live.",
      ),
    }
  }
  if (verdict === "TRADE_LIMIT_REACHED") {
    return {
      label: "TRADE LIMIT REACHED",
      tone: "loss",
      description: sanitizeCoachLanguage(
        "Chapter trade cap hit — protect the week even when the setup is A+.",
      ),
    }
  }
  return {
    label: "SKIP TRADE",
    tone: "loss",
    description: sanitizeCoachLanguage(
      "Structural rule failed — skip and wait for a cleaner read.",
    ),
  }
}

export function coachVerdictClassName(tone: CoachVerdictDisplay["tone"]): string {
  if (tone === "profit") return "border-profit/35 bg-profit/[0.12] text-profit"
  if (tone === "amber") return "border-warning/35 bg-warning/[0.12] text-warning-foreground"
  return "border-loss/35 bg-loss/[0.12] text-loss"
}
