import type { AdaptiveCognitionInput, PerformanceAttribution } from "@/lib/adaptive-cognition/types"

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function normalize(parts: Record<string, number>): PerformanceAttribution {
  const total = Object.values(parts).reduce((a, b) => a + b, 0) || 1
  const scale = 100 / total
  return {
    luck: clamp(parts.luck * scale),
    skill: clamp(parts.skill * scale),
    discipline: clamp(parts.discipline * scale),
    execution: clamp(parts.execution * scale),
    marketConditions: clamp(parts.marketConditions * scale),
    narrative: "",
    luckyWinWarning: null,
  }
}

export function buildPerformanceIntelligence(input: AdaptiveCognitionInput): PerformanceAttribution {
  const { context } = input
  const last = context.recentTrades[0]
  if (!last) {
    return {
      luck: 20,
      skill: 25,
      discipline: 25,
      execution: 20,
      marketConditions: 10,
      narrative: "Not enough trades to attribute performance.",
      luckyWinWarning: null,
    }
  }

  const impulsive = /fomo|revenge|euphoric|anxious|tilted/i.test(last.emotion || "")
  const ruleBroken = last.rule_followed === false
  const isWin = last.result === "WIN"

  let luck = isWin && (impulsive || ruleBroken) ? 45 : isWin ? 18 : 22
  let discipline = last.rule_followed === true ? 35 : 8
  let execution = context.tradingOs?.liveCompanion.executionQuality ?? 28
  let skill = isWin && !impulsive && last.rule_followed ? 32 : 18
  let marketConditions = context.cognitive?.marketEnvironment.confidence ?? 15

  if (impulsive) {
    discipline = Math.max(5, discipline - 15)
    skill = Math.max(8, skill - 10)
    luck += 12
  }

  const attr = normalize({ luck, skill, discipline, execution, marketConditions })

  const luckyWinWarning =
    isWin && (impulsive || ruleBroken)
      ? "This win may be luck, not skill — do not reinforce bad behavior with size-up."
      : isWin && attr.luck >= 40
        ? "Outcome positive but process weak — review before repeating."
        : null

  attr.narrative = [
    `Last trade attribution: skill ${attr.skill}%, discipline ${attr.discipline}%, luck ${attr.luck}%.`,
    luckyWinWarning ?? "Process and outcome aligned enough to learn from.",
  ].join(" ")

  attr.luckyWinWarning = luckyWinWarning
  return attr
}
