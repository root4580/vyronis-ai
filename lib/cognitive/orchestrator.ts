import { evaluateCognitiveState } from "@/lib/cognitive/cognitive-state-engine"
import { buildDecisionConfidenceGraph } from "@/lib/cognitive/decision-confidence-graph"
import { resolveAdaptiveCoaching } from "@/lib/cognitive/adaptive-coaching-engine"
import { evaluateMarketEnvironment } from "@/lib/cognitive/market-environment-engine"
import { buildMultiLayerMemory } from "@/lib/cognitive/multi-layer-memory"
import { buildPredictions } from "@/lib/cognitive/prediction-layer"
import type {
  CognitiveEngineInput,
  CognitiveIntelligenceSnapshot,
} from "@/lib/cognitive/types"

/**
 * Cognitive Architecture orchestrator — composes state, confidence graph,
 * adaptive coaching, market environment, memory layers, and predictions.
 */
/** Recompute cognitive layer with optional chart vision / session tone. */
export function enrichTraderContextWithCognitive(
  context: CognitiveEngineInput["context"],
  options?: Omit<CognitiveEngineInput, "context">,
): CognitiveEngineInput["context"] {
  return {
    ...context,
    cognitive: buildCognitiveIntelligenceSnapshot({
      context,
      chartVision: options?.chartVision,
      recentMessageTone: options?.recentMessageTone,
    }),
  }
}

export function buildCognitiveIntelligenceSnapshot(
  input: CognitiveEngineInput,
): CognitiveIntelligenceSnapshot {
  const state = evaluateCognitiveState(input)
  const confidenceGraph = buildDecisionConfidenceGraph(input)
  const coaching = resolveAdaptiveCoaching({ cognitive: input, state })
  const marketEnvironment = evaluateMarketEnvironment(input)
  const memory = buildMultiLayerMemory(input)
  const predictions = buildPredictions({ cognitive: input, state })

  return {
    computedAt: new Date().toISOString(),
    state,
    confidenceGraph,
    coaching,
    marketEnvironment,
    memory,
    predictions,
    replay: null,
    capabilities: {
      voice: "planned",
      mobileCompanion: "planned",
      wearableNotifications: "planned",
      liveMarketMonitoring: "partial",
      mt5ExecutionAssistant: "partial",
      streamingMemoryTimeline: "planned",
      aiReplaySimulator: "active",
    },
  }
}
