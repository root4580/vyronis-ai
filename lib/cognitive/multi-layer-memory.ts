import { buildComparativeMemoryLine } from "@/lib/intelligence/comparative-memory-engine"
import type { CognitiveEngineInput, MemoryLayerInsight, MultiLayerMemorySnapshot } from "@/lib/cognitive/types"

export function buildMultiLayerMemory(input: CognitiveEngineInput): MultiLayerMemorySnapshot {
  const { context, chartVision } = input
  const layers: MemoryLayerInsight[] = []

  const tradeInsights = context.recentTrades.slice(0, 5).map(
    (t) => `${t.pair} ${t.result} (${t.pnl >= 0 ? "+" : ""}${t.pnl})`,
  )
  if (tradeInsights.length > 0) {
    layers.push({
      layer: "trade",
      insights: tradeInsights,
      strength: Math.min(95, 40 + tradeInsights.length * 10),
    })
  }

  const emotionalInsights: string[] = []
  if (context.emotionalState.dominantEmotion) {
    emotionalInsights.push(`Dominant emotion: ${context.emotionalState.dominantEmotion}`)
  }
  if (context.emotionalState.note) emotionalInsights.push(context.emotionalState.note)
  for (const m of context.compressedMemories.filter((c) => c.category === "emotional_trigger")) {
    emotionalInsights.push(m.insight)
  }
  if (emotionalInsights.length > 0) {
    layers.push({ layer: "emotional", insights: emotionalInsights.slice(0, 4), strength: 70 })
  }

  const setupInsights: string[] = []
  if (context.autonomous?.traderDna.bestSetupTypes[0]) {
    setupInsights.push(`Best setups: ${context.autonomous.traderDna.bestSetupTypes.join(", ")}`)
  }
  const comparative = buildComparativeMemoryLine({ context, chartVision })
  if (comparative) setupInsights.push(comparative)
  if (context.autonomous?.patternMatch.narrative) {
    setupInsights.push(context.autonomous.patternMatch.narrative)
  }
  if (setupInsights.length > 0) {
    layers.push({ layer: "setup", insights: setupInsights.slice(0, 4), strength: 75 })
  }

  const marketInsights: string[] = []
  if (context.autonomous?.session.narrative) {
    marketInsights.push(context.autonomous.session.narrative)
  }
  if (chartVision?.bundle?.inferredStack) {
    marketInsights.push(`Structure stack: ${chartVision.bundle.inferredStack}`)
  }
  if (marketInsights.length > 0) {
    layers.push({ layer: "market", insights: marketInsights, strength: 65 })
  }

  const behavioralInsights: string[] = []
  for (const p of context.memory.topPatterns.slice(0, 3)) {
    behavioralInsights.push(p.message)
  }
  if (context.memory.primaryLeak.status === "active") {
    behavioralInsights.push(context.memory.primaryLeak.headline)
  }
  for (const m of context.compressedMemories.filter((c) =>
    ["repeated_behavior", "dangerous_pattern"].includes(c.category),
  )) {
    behavioralInsights.push(m.insight)
  }
  if (behavioralInsights.length > 0) {
    layers.push({
      layer: "behavioral",
      insights: behavioralInsights.slice(0, 5),
      strength: 80,
    })
  }

  const crossParts: string[] = []
  const emotional = layers.find((l) => l.layer === "emotional")
  const setup = layers.find((l) => l.layer === "setup")
  const behavioral = layers.find((l) => l.layer === "behavioral")
  if (setup?.insights[0] && emotional?.insights[0]) {
    crossParts.push(`Setup memory and emotional memory both active — weigh ${emotional.insights[0]} against ${setup.insights[0]}.`)
  }
  if (behavioral?.insights[0] && setup?.insights[0]) {
    crossParts.push(`Behavioral pattern may override setup edge: ${behavioral.insights[0]}.`)
  }
  const crossMemorySynthesis =
    crossParts.join(" ") ||
    "Cross-memory synthesis: journal, setup, and session context are aligned for standard coaching."

  return { layers, crossMemorySynthesis }
}
