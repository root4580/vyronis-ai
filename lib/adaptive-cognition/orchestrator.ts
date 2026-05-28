import { buildTraderIdentity } from "@/lib/adaptive-cognition/identity-layer"
import { buildLifeContextSnapshot } from "@/lib/adaptive-cognition/life-context"
import { buildBehavioralModel } from "@/lib/adaptive-cognition/behavioral-modeling"
import { buildPerformanceIntelligence } from "@/lib/adaptive-cognition/performance-intelligence"
import { buildPersonalOperatingSystem } from "@/lib/adaptive-cognition/personal-os"
import { buildStrategicThinking } from "@/lib/adaptive-cognition/strategic-thinking"
import { buildCompanionEvolution } from "@/lib/adaptive-cognition/companion-evolution"
import { generateAutonomousInsights } from "@/lib/adaptive-cognition/insight-generation"
import { buildIntelligenceEcosystem } from "@/lib/adaptive-cognition/ecosystem"
import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type {
  AdaptiveCognitionInput,
  AdaptiveCognitionSnapshot,
} from "@/lib/adaptive-cognition/types"

export function buildAdaptiveCognitionSnapshot(
  input: AdaptiveCognitionInput,
): AdaptiveCognitionSnapshot {
  const identity = buildTraderIdentity(input)
  const lifeContext = buildLifeContextSnapshot(input)
  const behavioral = buildBehavioralModel(input)
  const performance = buildPerformanceIntelligence(input)
  const personalOs = buildPersonalOperatingSystem(input)
  const strategic = buildStrategicThinking(input)
  const companion = buildCompanionEvolution(input)
  const insights = generateAutonomousInsights(input)
  const ecosystem = buildIntelligenceEcosystem()

  const headline =
    insights[0]?.message ??
    identity.becoming.slice(0, 100) ??
    "Vyronis adaptive cognition — optimizing the human behind the trades."

  return {
    computedAt: new Date().toISOString(),
    identity,
    lifeContext,
    behavioral,
    performance,
    personalOs,
    strategic,
    companion,
    insights,
    ecosystem,
    headline,
  }
}

export function enrichTraderContextWithAdaptiveCognition(
  context: FullTraderContext,
  options?: Omit<AdaptiveCognitionInput, "context">,
): FullTraderContext {
  return {
    ...context,
    adaptiveCognition: buildAdaptiveCognitionSnapshot({
      context,
      lifeContextHistory: options?.lifeContextHistory,
    }),
  }
}
