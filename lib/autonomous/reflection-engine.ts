import { parseMistakeTags } from "@/lib/trade-form-config"
import type { TradeReflection } from "@/lib/autonomous/types"

export type ReflectionTradeInput = {
  id: string
  pair: string
  direction: string
  result: string
  pnl: number
  emotion?: string | null
  session?: string | null
  rule_followed?: boolean | null
  mistake_tags?: string | null
  notes?: string | null
  setup?: string | null
  planned_notes?: string | null
}

/**
 * Reflection Engine — post-trade plan vs execution and lesson memory.
 */
export function reflectOnCompletedTrade(trade: ReflectionTradeInput): TradeReflection {
  const mistakes = parseMistakeTags(trade.mistake_tags)
  const disciplineGaps: string[] = []

  if (trade.rule_followed === false) {
    disciplineGaps.push("Rules not followed on this trade")
  }
  if (mistakes.length > 0) {
    disciplineGaps.push(...mistakes.slice(0, 3))
  }
  if (/fomo|revenge|tilted|impulsive/i.test(String(trade.emotion || ""))) {
    disciplineGaps.push(`Emotional entry state: ${trade.emotion}`)
  }

  const planVsExecution =
    trade.planned_notes && trade.notes
      ? `Plan noted: "${trade.planned_notes.slice(0, 120)}". Execution notes: "${trade.notes.slice(0, 120)}".`
      : trade.result === "WIN"
        ? "Execution aligned with plan — outcome positive."
        : mistakes.length > 0
          ? `Execution drifted: ${mistakes.join(", ")}.`
          : "Limited plan detail — log pre-trade intent next time for sharper reflection."

  const emotionBeforeAfter =
    trade.emotion
      ? `Emotion logged: ${trade.emotion}. ${trade.result === "LOSS" ? "Check if emotion drove sizing or entry." : "Emotional state held through the trade."}`
      : "No emotion logged — add before/after for better coaching."

  let category: TradeReflection["category"] = "discipline"
  if (disciplineGaps.some((g) => /emotion|fomo|revenge/i.test(g))) category = "emotion"
  else if (mistakes.some((m) => /early|late|chase/i.test(m))) category = "execution"
  else if (trade.result === "LOSS" && !trade.rule_followed) category = "risk"
  else if (trade.session) category = "session"

  let lesson = "Solid process — reinforce what worked."
  if (trade.result === "LOSS") {
    lesson =
      disciplineGaps[0] ??
      "Loss without tagged mistake — review chart and session context before next entry."
  } else if (disciplineGaps.length > 0) {
    lesson = `Win with gaps: ${disciplineGaps[0]} — tighten next time.`
  }

  const score =
    trade.result === "WIN" && disciplineGaps.length === 0
      ? 85
      : trade.result === "WIN"
        ? 65
        : disciplineGaps.length === 0
          ? 45
          : 30

  return {
    planVsExecution,
    emotionBeforeAfter,
    disciplineGaps,
    lesson,
    category,
    score,
  }
}
