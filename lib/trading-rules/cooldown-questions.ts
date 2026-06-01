import type { CooldownUnlockAnswers } from "@/lib/trading-rules/types"
import {
  COOLDOWN_WARM_QUESTIONS,
  sanitizeCoachLanguage,
} from "@/lib/coach-chapters/personality"

export const COOLDOWN_UNLOCK_QUESTIONS = COOLDOWN_WARM_QUESTIONS

export function parseCooldownUnlockAnswers(input: {
  lossCause?: string
  changePlan?: string
  emotionalScore?: number | string
}): CooldownUnlockAnswers | null {
  const lossCause = input.lossCause?.trim() ?? ""
  const changePlan = input.changePlan?.trim() ?? ""
  const emotionalScore =
    typeof input.emotionalScore === "number"
      ? input.emotionalScore
      : Number.parseInt(String(input.emotionalScore ?? ""), 10)

  if (!lossCause || !changePlan) return null
  if (!Number.isFinite(emotionalScore) || emotionalScore < 1 || emotionalScore > 10) return null

  return { lossCause, changePlan, emotionalScore }
}

export function buildCooldownUnlockCoachSummary(answers: CooldownUnlockAnswers): string {
  return sanitizeCoachLanguage(
    [
      "Cooldown reflection",
      `What happened: ${answers.lossCause}`,
      `Next entry change: ${answers.changePlan}`,
      `Mind clarity: ${answers.emotionalScore}/10`,
    ].join("\n"),
  )
}
