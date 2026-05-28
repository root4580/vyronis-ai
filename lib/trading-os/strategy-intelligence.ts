import type { StrategyIntelligenceSnapshot, TradingOsEngineInput } from "@/lib/trading-os/types"

export function buildStrategyIntelligence(input: TradingOsEngineInput): StrategyIntelligenceSnapshot {
  const { context } = input
  const dna = context.autonomous?.traderDna
  const cognitive = context.cognitive
  const guidance: string[] = []

  const topSetupModel = dna?.bestSetupTypes[0] ?? context.playbooks.find((p) => p.is_default)?.strategy_name ?? null

  const weakestConditions: string[] = []
  if (dna?.recurringMistakes[0]) weakestConditions.push(dna.recurringMistakes[0])
  if (cognitive?.marketEnvironment.labels.includes("choppy")) {
    weakestConditions.push("Choppy / low-quality structure environments")
  }
  const worstSession = [...context.sessionPerformance]
    .filter((s) => s.tradeCount >= 3)
    .sort((a, b) => a.winRate - b.winRate)[0]
  if (worstSession && worstSession.winRate < 45) {
    weakestConditions.push(`${worstSession.name} (${worstSession.winRate}% WR)`)
  }

  const emotionalIncompatibilities: string[] = []
  for (const trigger of dna?.emotionalTriggers ?? []) {
    emotionalIncompatibilities.push(trigger)
  }
  if (context.emotionalState.impulsiveCount >= 2) {
    emotionalIncompatibilities.push("Impulsive emotion cluster in recent journal")
  }
  if (context.mistakeHeatmap[0]?.lossRate >= 60) {
    emotionalIncompatibilities.push(`${context.mistakeHeatmap[0].label} mistake pattern`)
  }

  const sessionEdge = context.sessionPerformance
    .filter((s) => s.tradeCount >= 2)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 3)
    .map((s) => ({
      session: s.name,
      edge: s.winRate >= 55 ? "Playbook edge" : s.winRate >= 45 ? "Neutral — selective" : "Reduce exposure",
      winRate: s.winRate,
    }))

  if (topSetupModel) {
    guidance.push(`Lead with ${topSetupModel} when structure and session align.`)
  }
  if (sessionEdge[0]) {
    guidance.push(
      `Highest session edge: ${sessionEdge[0].session} (${sessionEdge[0].winRate}% WR) — prioritize A+ setups there.`,
    )
  }
  if (weakestConditions[0]) {
    guidance.push(`Stand down or cut size when: ${weakestConditions[0]}.`)
  }
  if (cognitive?.coaching.coachingFocus) {
    guidance.push(cognitive.coaching.coachingFocus)
  }
  if (dna?.idealMarketConditions) {
    guidance.push(dna.idealMarketConditions)
  }

  return {
    topSetupModel,
    weakestConditions: weakestConditions.slice(0, 4),
    emotionalIncompatibilities: emotionalIncompatibilities.slice(0, 4),
    sessionEdge,
    adaptiveGuidance: guidance.slice(0, 5),
  }
}
