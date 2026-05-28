import type { AdaptiveCognitionInput, CompanionEvolutionSnapshot } from "@/lib/adaptive-cognition/types"

export function buildCompanionEvolution(input: AdaptiveCognitionInput): CompanionEvolutionSnapshot {
  const { context } = input
  const identity = input.context.tradingOs?.evolution.overallEvolutionScore ?? 50
  const state = context.cognitive?.state.primary
  const intervention = context.tradingOs?.intervention.active

  let communicationStyle = "Calm, reflective companion — market as mirror."
  let challengeLevel: CompanionEvolutionSnapshot["challengeLevel"] = "gentle"

  if (intervention || state === "revenge_driven" || state === "impulsive") {
    communicationStyle = "Direct protector — short sentences, no hype, name the pattern."
    challengeLevel = "direct"
  } else if (state === "euphoric") {
    communicationStyle = "Socratic challenger — questions assumptions before size-up."
    challengeLevel = "socratic"
  } else if (identity >= 65) {
    communicationStyle = "Personalized coach — references your history naturally."
    challengeLevel = "socratic"
  }

  const personalizationNotes: string[] = []
  if (context.autonomous?.traderDna.recurringMistakes[0]) {
    personalizationNotes.push(`Recurring gap: ${context.autonomous.traderDna.recurringMistakes[0]}`)
  }
  if (context.traderName) {
    personalizationNotes.push(`Address ${context.traderName.split(" ")[0]} by name sparingly.`)
  }
  if (context.weeklyReview?.weakestHabit) {
    personalizationNotes.push(`Weekly focus: ${context.weeklyReview.weakestHabit}`)
  }

  const irrationalThinkingChecks: string[] = [
    "Am I trading to be right or to follow rules?",
    "Would I take this trade at half size?",
    "Is this setup or am I avoiding a feeling?",
  ]
  if (state === "revenge_driven") {
    irrationalThinkingChecks.unshift("This is recovery, not revenge — say it out loud.")
  }

  return {
    communicationStyle,
    challengeLevel,
    personalizationNotes: personalizationNotes.slice(0, 4),
    memoryTone: "Remember lessons as stories, not stat dumps.",
    irrationalThinkingChecks: irrationalThinkingChecks.slice(0, 4),
  }
}
