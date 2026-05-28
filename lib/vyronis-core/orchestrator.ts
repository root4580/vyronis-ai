import {
  VYRONIS_DESIGN_PHILOSOPHY,
  VYRONIS_EVOLUTION_ROADMAP,
  computeOverallMaturity,
  currentPhaseFocus,
} from "@/lib/vyronis-core/roadmap"
import {
  buildAdaptiveRiskRestriction,
  buildConfidenceDecay,
  buildInterventionPrompt,
  buildLiveTraderState,
  buildPreTradeApproval,
  buildRuleViolationForecast,
  buildSetupProbability,
} from "@/lib/vyronis-core/phase5-engine"
import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import { buildVisionIntelligenceSnapshot } from "@/lib/vyronis-core/phase7-engine"
import type { Phase5AutonomousLayer, UnifiedMemoryStatus, VyronisCoreInput, VyronisCoreSnapshot } from "@/lib/vyronis-core/types"

function buildUnifiedMemory(context: FullTraderContext): UnifiedMemoryStatus {
  const categories = [
    "trade",
    "emotional",
    "market",
    "setup",
    "behavioral",
    "coaching",
  ] as UnifiedMemoryStatus["categories"]

  const activeEngines = [
    context.autonomous ? "autonomous" : null,
    context.cognitive ? "cognitive" : null,
    context.tradingOs ? "trading-os" : null,
    context.adaptiveCognition ? "adaptive-cognition" : null,
    "trade-memory",
    "pattern-fingerprints",
    "compressed-insights",
  ].filter(Boolean) as string[]

  return {
    categories: [...categories],
    activeEngines,
    narrative:
      "One evolving memory system — trade, emotional, market, setup, behavioral, and coaching layers cross-linked in the cognitive core.",
  }
}

function buildPhase5Layer(context: FullTraderContext): Phase5AutonomousLayer {
  const shadow =
    context.autonomous?.shadow ?? {
      emotionalRiskScore: 50,
      disciplineConfidence: 50,
      executionQualityPrediction: 50,
      overtradingProbability: 20,
      revengeTradingSignal: 15,
      impulsiveEntryLikelihood: 20,
      disciplineDrift: 20,
      overallRiskLevel: "moderate",
      flags: [],
      proactiveMessage: "Shadow layer awaiting context.",
      shouldPause: false,
    }

  return {
    shadow,
    preTradeApproval: buildPreTradeApproval(context),
    confidenceDecay: buildConfidenceDecay(context),
    setupProbability: buildSetupProbability(context),
    adaptiveRisk: buildAdaptiveRiskRestriction(context),
    liveTraderState: buildLiveTraderState(context),
    ruleViolationForecast: buildRuleViolationForecast(context),
    interventionPrompt: buildInterventionPrompt(context),
  }
}

/**
 * Unified Vyronis cognitive core — one orchestrator composing all intelligence layers.
 */
export function buildVyronisCoreSnapshot(input: VyronisCoreInput): VyronisCoreSnapshot {
  const { context } = input
  const phases = VYRONIS_EVOLUTION_ROADMAP
  const overallMaturity = computeOverallMaturity(phases)
  const phaseFocus = currentPhaseFocus(phases)
  const phase5 = buildPhase5Layer(context)
  const phase7 =
    input.chartVision != null
      ? buildVisionIntelligenceSnapshot({ context, chartVision: input.chartVision })
      : context.visionIntelligence ?? null

  const headline =
    phase5.interventionPrompt ??
    phase5.preTradeApproval.headline ??
    context.adaptiveCognition?.headline ??
    context.tradingOs?.proactiveHeadline ??
    "Vyronis cognitive core active — one companion, one memory, many engines."

  return {
    computedAt: new Date().toISOString(),
    philosophy: VYRONIS_DESIGN_PHILOSOPHY,
    phases,
    overallMaturity,
    currentPhaseFocus: phaseFocus,
    phase5,
    phase7,
    memory: buildUnifiedMemory(context),
    layers: {
      autonomous: context.autonomous ?? null,
      cognitive: context.cognitive ?? null,
      tradingOs: context.tradingOs ?? null,
      adaptiveCognition: context.adaptiveCognition ?? null,
    },
    headline,
  }
}

export function enrichTraderContextWithVyronisCore(
  context: FullTraderContext,
  chartVision?: VyronisCoreInput["chartVision"],
): FullTraderContext {
  const visionIntelligence =
    chartVision != null
      ? buildVisionIntelligenceSnapshot({ context, chartVision })
      : context.visionIntelligence ?? null
  return {
    ...context,
    visionIntelligence,
    vyronisCore: buildVyronisCoreSnapshot({ context, chartVision }),
  }
}
