import { reflectOnCompletedTrade } from "@/lib/autonomous/reflection-engine"
import type { ReflectionTradeInput } from "@/lib/autonomous/reflection-engine"
import type { TradeReplayIntelligence } from "@/lib/cognitive/types"

export function buildTradeReplayIntelligence(
  trade: ReflectionTradeInput,
  options?: { plannedNotes?: string | null },
): TradeReplayIntelligence {
  const reflection = reflectOnCompletedTrade({
    ...trade,
    planned_notes: options?.plannedNotes ?? trade.planned_notes,
  })

  const plannedLogic =
    trade.planned_notes?.trim() ||
    (trade.setup ? `Planned ${trade.setup} on ${trade.pair}` : `Planned ${trade.direction} on ${trade.pair}`)

  const actualOutcome = `${trade.result} (${trade.pnl >= 0 ? "+" : ""}${trade.pnl}) — ${reflection.planVsExecution}`

  const emotionalDeviationMoments: string[] = []
  if (/fomo|revenge|tilted|anxious|impulsive/i.test(String(trade.emotion || ""))) {
    emotionalDeviationMoments.push(`Emotion at entry: ${trade.emotion}`)
  }
  for (const gap of reflection.disciplineGaps) {
    if (/emotion|fomo|revenge/i.test(gap)) {
      emotionalDeviationMoments.push(gap)
    }
  }
  if (emotionalDeviationMoments.length === 0 && trade.result === "LOSS") {
    emotionalDeviationMoments.push("No tagged emotion — harder to detect drift retroactively.")
  }

  const whatChanged =
    trade.result === "WIN"
      ? reflection.disciplineGaps.length > 0
        ? `Win with process gaps: ${reflection.disciplineGaps[0]}`
        : "Execution matched plan — outcome aligned with process."
      : `Outcome diverged: ${reflection.disciplineGaps.join("; ") || reflection.lesson}`

  const reconstructionScore =
    trade.result === "WIN" && reflection.disciplineGaps.length === 0
      ? 88
      : trade.result === "WIN"
        ? 62
        : reflection.disciplineGaps.length > 0
          ? 45
          : 55

  return {
    plannedLogic,
    actualOutcome,
    whatChanged,
    emotionalDeviationMoments: emotionalDeviationMoments.slice(0, 4),
    lesson: reflection.lesson,
    reconstructionScore,
  }
}
