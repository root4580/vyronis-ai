import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type { OutcomeLessonRecord } from "@/lib/learning/outcome-learning-engine"

export type TraderMemoryLine = {
  id: string
  text: string
  priority: number
}

/**
 * One or two organic memory lines for conversation — no dumps.
 */
export function pickTraderMemoryLines(input: {
  context: FullTraderContext
  userMessage?: string
  outcomeLessons?: OutcomeLessonRecord[]
  maxLines?: number
}): string[] {
  const { context, userMessage = "", outcomeLessons = [] } = input
  const max = input.maxLines ?? 2
  const candidates: TraderMemoryLine[] = []
  const msg = userMessage.toLowerCase()

  for (const lesson of outcomeLessons.slice(0, 6)) {
    if (lesson.naturalReference) {
      candidates.push({
        id: `outcome-${lesson.tradeId}`,
        text: lesson.naturalReference,
        priority: lesson.vyronisWasRight === false ? 90 : 70,
      })
    }
  }

  const topMistake = context.mistakeHeatmap[0]
  if (topMistake && topMistake.count >= 2) {
    candidates.push({
      id: "mistake-heatmap",
      text: `You've tagged "${topMistake.label}" ${topMistake.count} times — worth naming before the next entry.`,
      priority: 75,
    })
  }

  const weakSession = [...context.sessionPerformance]
    .filter((s) => s.tradeCount >= 3)
    .sort((a, b) => a.winRate - b.winRate)[0]
  if (weakSession && weakSession.winRate < 45) {
    candidates.push({
      id: "weak-session",
      text: `${weakSession.name} has been your toughest window lately (${weakSession.winRate}% win rate).`,
      priority: 62,
    })
  }

  const strongSession = [...context.sessionPerformance]
    .filter((s) => s.tradeCount >= 3)
    .sort((a, b) => b.winRate - a.winRate)[0]
  if (strongSession && strongSession.winRate >= 55 && /session|when|time/i.test(msg)) {
    candidates.push({
      id: "strong-session",
      text: `Your cleanest reads tend to show up in ${strongSession.name}.`,
      priority: 58,
    })
  }

  const dna = context.autonomous?.traderDna
  if (dna?.recurringMistakes[0] && /mistake|pattern|again|why/i.test(msg)) {
    candidates.push({
      id: "dna-mistake",
      text: `Recurring pattern in your journal: ${dna.recurringMistakes[0]}.`,
      priority: 72,
    })
  }

  if (dna?.bestSetupTypes[0] && /setup|take|plan/i.test(msg)) {
    candidates.push({
      id: "dna-setup",
      text: `Your journal favors ${dna.bestSetupTypes.slice(0, 2).join(" and ")} when process is clean.`,
      priority: 55,
    })
  }

  const impulsiveRecent = context.recentTrades
    .slice(0, 4)
    .filter((t) => /fomo|revenge|anxious|tilted/i.test(t.emotion || ""))
  const ei = context.emotionalIntelligence
  if (ei?.activeSignals.includes("emotional_drift")) {
    candidates.push({
      id: "emotional-drift-ei",
      text: ei.signals.find((s) => s.id === "emotional_drift")?.message ?? ei.headline,
      priority: 90,
    })
  }
  if (ei?.activeSignals.includes("revenge_behavior")) {
    candidates.push({
      id: "revenge-ei",
      text: ei.signals.find((s) => s.id === "revenge_behavior")?.message ?? ei.headline,
      priority: 92,
    })
  }
  if (ei?.activeSignals.includes("quality_patience")) {
    candidates.push({
      id: "patience-ei",
      text: ei.signals.find((s) => s.id === "quality_patience")?.message ?? ei.headline,
      priority: 55,
    })
  }

  if (impulsiveRecent.length >= 2) {
    candidates.push({
      id: "emotional-drift",
      text: "This resembles your last couple of entries after emotional drift — pause before sizing up.",
      priority: 88,
    })
  }

  const continuationLosses = context.recentTrades
    .slice(0, 5)
    .filter((t) => t.result === "LOSS")
  if (continuationLosses.length >= 2 && /continuation|chase|similar/i.test(msg)) {
    candidates.push({
      id: "continuation-losses",
      text: "This resembles your last two losing continuation entries after emotional drift.",
      priority: 85,
    })
  }

  if (context.memory.primaryLeak.status === "active" && /risk|leak|habit/i.test(msg)) {
    candidates.push({
      id: "primary-leak",
      text: `${context.memory.primaryLeak.headline} — ${context.memory.primaryLeak.correctiveAction}`,
      priority: 68,
    })
  }

  const sorted = [...candidates].sort((a, b) => b.priority - a.priority)
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of sorted) {
    if (seen.has(c.text.slice(0, 40))) continue
    seen.add(c.text.slice(0, 40))
    out.push(c.text)
    if (out.length >= max) break
  }
  return out
}
