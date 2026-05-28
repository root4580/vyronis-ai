/**
 * Vyronis Cognitive Architecture — engine registry (Phase: Cognitive Architecture)
 */

export type CognitiveLayerId =
  | "state"
  | "confidence"
  | "coaching"
  | "market"
  | "memory"
  | "prediction"
  | "replay"
  | "orchestration"

export type CognitiveEngineDescriptor = {
  id: string
  layer: CognitiveLayerId
  description: string
  module: string
  status: "active" | "partial" | "planned"
}

export const COGNITIVE_ENGINES: CognitiveEngineDescriptor[] = [
  {
    id: "cognitive-state",
    layer: "state",
    description: "Calm, focused, impulsive, revenge, fatigued, euphoric, disciplined",
    module: "lib/cognitive/cognitive-state-engine.ts",
    status: "active",
  },
  {
    id: "decision-confidence-graph",
    layer: "confidence",
    description: "Perceived vs actual confidence before/during/after",
    module: "lib/cognitive/decision-confidence-graph.ts",
    status: "active",
  },
  {
    id: "adaptive-coaching",
    layer: "coaching",
    description: "Personality modes: guardian, reset, anti-revenge, restoration",
    module: "lib/cognitive/adaptive-coaching-engine.ts",
    status: "active",
  },
  {
    id: "market-environment",
    layer: "market",
    description: "Trending, compression, reversal, liquidity sweep labels",
    module: "lib/cognitive/market-environment-engine.ts",
    status: "active",
  },
  {
    id: "multi-layer-memory",
    layer: "memory",
    description: "Trade, emotional, setup, market, behavioral cross-reasoning",
    module: "lib/cognitive/multi-layer-memory.ts",
    status: "active",
  },
  {
    id: "prediction-layer",
    layer: "prediction",
    description: "Overtrading, revenge, execution, discipline trajectory",
    module: "lib/cognitive/prediction-layer.ts",
    status: "active",
  },
  {
    id: "trade-replay-intelligence",
    layer: "replay",
    description: "Post-trade what-changed reconstruction",
    module: "lib/cognitive/trade-replay-intelligence.ts",
    status: "active",
  },
  {
    id: "cognitive-orchestrator",
    layer: "orchestration",
    description: "Unified cognitive snapshot for Command Center",
    module: "lib/cognitive/orchestrator.ts",
    status: "active",
  },
  {
    id: "voice-conversations",
    layer: "orchestration",
    description: "Voice companion interface",
    module: "lib/cognitive/long-term.ts",
    status: "planned",
  },
  {
    id: "streaming-memory-timeline",
    layer: "memory",
    description: "Live memory timeline stream",
    module: "planned",
    status: "planned",
  },
]
