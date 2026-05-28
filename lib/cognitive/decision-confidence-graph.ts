import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type {
  CognitiveEngineInput,
  ConfidenceNode,
  DecisionConfidenceGraph,
} from "@/lib/cognitive/types"

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function buildDecisionConfidenceGraph(
  input: CognitiveEngineInput,
): DecisionConfidenceGraph {
  const { context } = input
  const shadow = context.autonomous?.shadow
  const recent = context.recentTrades.slice(0, 8)
  const wins = recent.filter((t) => t.result === "WIN").length
  const winRate = recent.length > 0 ? wins / recent.length : 0.5

  const beforePerceived = clamp(
    (context.activePlannedContext?.setup?.includes("A+") ? 78 : 58) +
      (shadow?.disciplineConfidence ? shadow.disciplineConfidence * 0.15 : 0),
  )
  const beforeQuality = clamp(
    (shadow?.executionQualityPrediction ?? 55) * 0.6 +
      (context.memory.snapshot.winRate ?? 50) * 0.25,
  )

  const duringPerceived = clamp(beforePerceived * 0.92 + (winRate >= 0.5 ? 8 : -12))
  const duringQuality = clamp(
    beforeQuality * 0.85 +
      (context.emotionalState.trend === "volatile" ? -18 : 0),
  )

  const last = recent[0]
  const afterPerceived = clamp(
    last?.result === "WIN" ? 72 : last?.result === "LOSS" ? 38 : 50,
  )
  const afterQuality = clamp(
    last?.result === "WIN" && (last as { rule_followed?: boolean }).rule_followed !== false
      ? 75
      : last?.result === "LOSS"
        ? 35
        : 50,
  )

  const nodes: ConfidenceNode[] = [
    {
      phase: "before_entry",
      perceived: beforePerceived,
      inferredQuality: beforeQuality,
      gap: beforePerceived - beforeQuality,
      label: "Pre-entry confidence vs setup quality",
    },
    {
      phase: "during_trade",
      perceived: duringPerceived,
      inferredQuality: duringQuality,
      gap: duringPerceived - duringQuality,
      label: "In-trade confidence vs process",
    },
    {
      phase: "after_outcome",
      perceived: afterPerceived,
      inferredQuality: afterQuality,
      gap: afterPerceived - afterQuality,
      label: "Post-outcome confidence vs result quality",
    },
  ]

  const avgGap =
    nodes.reduce((s, n) => s + Math.abs(n.gap), 0) / Math.max(nodes.length, 1)
  const fakeConfidence = nodes.some((n) => n.gap >= 22 && n.perceived >= 65)
  const emotionalCertainty =
    fakeConfidence &&
    (context.emotionalState.trend === "volatile" ||
      /euphoric|fomo|revenge/i.test(String(context.emotionalState.dominantEmotion || "")))
  const hesitationPattern =
    nodes[0].perceived < 52 &&
    nodes[0].inferredQuality >= 58 &&
    context.emotionalState.trend !== "volatile"

  let narrative = `Confidence graph: pre-entry gap ${nodes[0].gap >= 0 ? "+" : ""}${nodes[0].gap} (perceived ${nodes[0].perceived} vs quality ${nodes[0].inferredQuality}).`
  if (fakeConfidence) {
    narrative += " Possible fake confidence — perceived certainty exceeds process quality."
  }
  if (hesitationPattern) {
    narrative += " Hesitation pattern — quality is there but conviction lags."
  }

  return {
    nodes,
    fakeConfidence,
    emotionalCertainty,
    hesitationPattern,
    narrative,
  }
}
