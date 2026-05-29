import type {
  ConfirmationChecklist,
  ConfirmationEvaluation,
} from "@/lib/strategy-brain/types"

const CONFIRMATION_LABELS: Record<keyof ConfirmationChecklist, string> = {
  break_and_retest: "Break and retest",
  ltf_structure_shift: "Lower timeframe structure shift",
  momentum_confirmation: "Momentum confirmation",
  ema_confirmation: "EMA confirmation",
  clear_invalidation: "Clear invalidation",
  acceptable_rr: "Acceptable risk-reward",
}

export function evaluateConfirmation(
  checklist: ConfirmationChecklist,
): ConfirmationEvaluation {
  const missing: string[] = []
  const borderline: string[] = []

  for (const key of Object.keys(CONFIRMATION_LABELS) as (keyof ConfirmationChecklist)[]) {
    const value = checklist[key]
    if (value === false) {
      missing.push(CONFIRMATION_LABELS[key])
    } else if (value === "borderline") {
      borderline.push(CONFIRMATION_LABELS[key])
    }
  }

  const confirmedCount = 6 - missing.length - borderline.length
  let setup_strength: ConfirmationEvaluation["setup_strength"]
  if (missing.length === 0 && borderline.length <= 1) {
    setup_strength = "strong"
  } else if (missing.length <= 2) {
    setup_strength = "moderate"
  } else {
    setup_strength = "weak"
  }

  let summary: string
  if (setup_strength === "strong") {
    summary = "Confirmation stack is clean — execution quality depends on timing and psychology."
  } else if (setup_strength === "moderate") {
    summary = `Setup is usable but incomplete${missing.length ? `: missing ${missing.slice(0, 2).join(", ")}` : ""}.`
  } else {
    summary = `Setup is weak — ${missing.length} confirmation${missing.length === 1 ? "" : "s"} missing. Wait for structure.`
  }

  return {
    checklist,
    missing,
    borderline,
    setup_strength,
    summary,
  }
}

export function defaultConfirmationChecklist(): ConfirmationChecklist {
  return {
    break_and_retest: false,
    ltf_structure_shift: false,
    momentum_confirmation: false,
    ema_confirmation: false,
    clear_invalidation: false,
    acceptable_rr: false,
  }
}
