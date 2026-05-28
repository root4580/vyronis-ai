import { parseMistakeTags } from "@/lib/trade-form-config"
import { getTradeRiskReward } from "@/lib/trade-form-utils"
import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type { TraderDnaProfile } from "@/lib/autonomous/types"

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * Trader DNA — evolving profile from journal history.
 * Recomputed on context build; persisted weekly via server-service.
 */
export function computeTraderDna(context: FullTraderContext): TraderDnaProfile {
  const trades = context.recentTrades
  const wins = trades.filter((t) => t.result === "WIN")
  const losses = trades.filter((t) => t.result === "LOSS")

  const setupStats = new Map<string, { w: number; t: number }>()
  const sessionStats = new Map<string, { w: number; t: number }>()
  const emotionLoss = new Map<string, number>()
  const rrValues: number[] = []

  for (const trade of trades) {
    const setup = String(
      (trade as { setup?: string }).setup ||
        (trade as { setup_classification?: string }).setup_classification ||
        "unknown",
    ).trim()
    if (setup && setup !== "unknown") {
      const row = setupStats.get(setup) ?? { w: 0, t: 0 }
      row.t += 1
      if (trade.result === "WIN") row.w += 1
      setupStats.set(setup, row)
    }

    const session = String(trade.session || "unknown").trim()
    if (session && session !== "unknown") {
      const row = sessionStats.get(session) ?? { w: 0, t: 0 }
      row.t += 1
      if (trade.result === "WIN") row.w += 1
      sessionStats.set(session, row)
    }

    if (trade.result === "LOSS" && trade.emotion) {
      const key = trade.emotion.toLowerCase()
      emotionLoss.set(key, (emotionLoss.get(key) ?? 0) + 1)
    }

    const rr = getTradeRiskReward({
      direction: trade.direction,
      risk_reward: (trade as { risk_reward?: number }).risk_reward,
      entry_price: (trade as { entry_price?: number }).entry_price,
      stop_loss: (trade as { stop_loss?: number }).stop_loss,
      take_profit: (trade as { take_profit?: number }).take_profit,
    })
    if (rr != null) rrValues.push(rr)
  }

  const bestSetups = [...setupStats.entries()]
    .filter(([, s]) => s.t >= 2)
    .sort((a, b) => b[1].w / b[1].t - a[1].w / a[1].t)
    .slice(0, 3)
    .map(([name]) => name)

  const bestSessions = [...sessionStats.entries()]
    .filter(([, s]) => s.t >= 2)
    .sort((a, b) => b[1].w / b[1].t - a[1].w / a[1].t)
    .slice(0, 2)
    .map(([name]) => name)

  const emotionalTriggers = [...emotionLoss.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([e]) => e)

  const mistakeCounts = new Map<string, number>()
  for (const trade of losses) {
    for (const tag of parseMistakeTags((trade as { mistake_tags?: string }).mistake_tags)) {
      mistakeCounts.set(tag, (mistakeCounts.get(tag) ?? 0) + 1)
    }
  }
  const recurringMistakes = [...mistakeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([m]) => m)

  const winRate =
    trades.length > 0 ? Math.round((wins.length / trades.length) * 100) : context.memory.snapshot.winRate

  const highestWinrateConditions =
    bestSetups.length > 0
      ? `${bestSetups[0]} setups (~${winRate}% recent win rate when aligned)`
      : `Journal win rate ~${winRate}%`

  const idealMarketConditions =
    bestSessions.length > 0
      ? `Favor ${bestSessions.join(" & ")} with structured ${bestSetups[0] || "A+"} setups`
      : context.preferredSession
        ? `${context.preferredSession} with calm emotional state`
        : "Calm session with rule adherence"

  let archetype = "Adaptive learner"
  if (context.memory.primaryLeak.status === "active" && context.memory.primaryLeak.headline) {
    archetype = `${context.memory.primaryLeak.headline} trader`
  } else if (bestSetups.length > 0 && emotionalTriggers.length === 0) {
    archetype = "Disciplined systematic trader"
  } else if (emotionalTriggers.length >= 2) {
    archetype = "Emotionally reactive trader (improving)"
  }

  const weeklyInsight = buildWeeklyInsight({
    archetype,
    bestSetups,
    bestSessions,
    recurringMistakes,
    winRate,
    leak: context.memory.primaryLeak.headline,
  })

  const confidenceScore = Math.min(
    95,
    40 + Math.min(trades.length * 3, 40) + (context.compressedMemories.length > 0 ? 10 : 0),
  )

  return {
    version: 1,
    bestSetupTypes: bestSetups,
    strongestSessions: bestSessions,
    emotionalTriggers,
    highestWinrateConditions,
    recurringMistakes,
    averageRr: average(rrValues),
    averageHoldMinutes: null,
    idealMarketConditions,
    archetype,
    weeklyInsight,
    confidenceScore,
    computedAt: new Date().toISOString(),
  }
}

function buildWeeklyInsight(input: {
  archetype: string
  bestSetups: string[]
  bestSessions: string[]
  recurringMistakes: string[]
  winRate: number
  leak: string
}): string {
  const parts = [`This week you're showing up as a ${input.archetype.toLowerCase()}.`]
  if (input.bestSetups[0]) {
    parts.push(`Strongest edge: ${input.bestSetups[0]} (${input.winRate}% recent win rate).`)
  }
  if (input.recurringMistakes[0]) {
    parts.push(`Watch recurring mistake: ${input.recurringMistakes[0]}.`)
  }
  if (input.leak && !/insufficient|no active/i.test(input.leak)) {
    parts.push(`Focus: ${input.leak}.`)
  }
  return parts.join(" ")
}
