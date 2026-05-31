/**
 * Vyronis Core Model — emotion filter for Vyronis strategy scoring.
 * Used by Vyronis AI pre-trade and journal intelligence workflows.
 */

import type {
  VyronisComponentResult,
  VyronisEmotionInput,
  VyronisEmotionState,
} from "@/types/strategy"

export const VYRONIS_EMOTION_STATES: VyronisEmotionState[] = [
  "calm",
  "confident",
  "fearful",
  "revenge",
  "impulsive",
  "overconfident",
]

const STABLE_STATES = new Set<VyronisEmotionState>(["calm", "confident"])
const HEAVY_PENALTY_STATES = new Set<VyronisEmotionState>(["revenge", "impulsive"])

const EMOTION_ALIASES: Record<string, VyronisEmotionState> = {
  calm: "calm",
  confident: "confident",
  disciplined: "confident",
  neutral: "calm",
  fearful: "fearful",
  fear: "fearful",
  anxious: "fearful",
  anxiety: "fearful",
  revenge: "revenge",
  impulsive: "impulsive",
  fomo: "impulsive",
  euphoric: "overconfident",
  overconfident: "overconfident",
  greedy: "overconfident",
}

export function normalizeEmotionState(raw: string | null | undefined): VyronisEmotionState {
  if (!raw?.trim()) return "fearful"
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_")
  return EMOTION_ALIASES[key] ?? "fearful"
}

export function isEmotionStable(state: VyronisEmotionState): boolean {
  return STABLE_STATES.has(state)
}

export function requiresHeavyEmotionPenalty(state: VyronisEmotionState): boolean {
  return HEAVY_PENALTY_STATES.has(state)
}

export type EmotionFilterResult = {
  state: VyronisEmotionState
  stable: boolean
  heavyPenalty: boolean
  /** Points out of maxWeight before global penalties */
  component: VyronisComponentResult
  /** Global score reduction applied after weighted sum (revenge / impulsive) */
  globalPenalty: number
}

export function evaluateEmotionalDiscipline(
  input: VyronisEmotionInput,
  maxPoints = 10,
): EmotionFilterResult {
  const state = normalizeEmotionState(input.state)
  const stable = isEmotionStable(state)
  const heavyPenalty = requiresHeavyEmotionPenalty(state)
  const reasons: string[] = []
  const warnings: string[] = []

  let points = 0

  if (state === "calm") {
    points = maxPoints
    reasons.push("Calm emotional state supports process-driven execution.")
  } else if (state === "confident") {
    points = Math.round(maxPoints * 0.9)
    reasons.push("Confident state is acceptable when tied to a validated plan.")
  } else if (state === "fearful") {
    points = Math.round(maxPoints * 0.35)
    warnings.push("Fearful state may distort entry timing and size.")
  } else if (state === "overconfident") {
    points = Math.round(maxPoints * 0.3)
    warnings.push("Overconfidence increases oversizing and rule-breaking risk.")
  } else if (state === "revenge") {
    points = 0
    warnings.push("Revenge state violates Vyronis discipline — hard psychology block.")
  } else if (state === "impulsive") {
    points = 0
    warnings.push("Impulsive state violates Vyronis discipline — hard psychology block.")
  }

  if (input.checkScore != null) {
    if (input.checkScore >= 80) {
      points = Math.min(maxPoints, points + 1)
      reasons.push(`Emotion check score ${input.checkScore}/100 supports execution.`)
    } else if (input.checkScore < 50) {
      points = Math.max(0, points - 2)
      warnings.push(`Emotion check score ${input.checkScore}/100 is elevated risk.`)
    }
  }

  if (!stable) {
    warnings.push(`Emotion "${state}" is not stable under Vyronis doctrine.`)
  }

  const globalPenalty = heavyPenalty ? 25 : state === "overconfident" ? 12 : state === "fearful" ? 8 : 0

  return {
    state,
    stable,
    heavyPenalty,
    globalPenalty,
    component: {
      points,
      maxPoints,
      reasons,
      warnings,
      passed: stable && points >= Math.round(maxPoints * 0.5),
    },
  }
}
