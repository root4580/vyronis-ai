import type { AdaptiveCognitionInput, IdentityDimension, TraderIdentitySnapshot } from "@/lib/adaptive-cognition/types"

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function trend(delta: number): IdentityDimension["trend"] {
  if (delta >= 6) return "rising"
  if (delta <= -6) return "falling"
  return "stable"
}

export function buildTraderIdentity(input: AdaptiveCognitionInput): TraderIdentitySnapshot {
  const { context } = input
  const recent = context.recentTrades
  const recent5 = recent.slice(0, 5)
  const prior5 = recent.slice(5, 10)

  const winRate5 =
    recent5.length > 0
      ? (recent5.filter((t) => t.result === "WIN").length / recent5.length) * 100
      : 50
  const winRatePrior =
    prior5.length > 0
      ? (prior5.filter((t) => t.result === "WIN").length / prior5.length) * 100
      : winRate5

  const ruleRate = (trades: typeof recent) => {
    const withRule = trades.filter((t) => t.rule_followed != null)
    if (withRule.length === 0) return 55
    return (withRule.filter((t) => t.rule_followed).length / withRule.length) * 100
  }

  const disciplineCurrent = ruleRate(recent5)
  const disciplinePrior = ruleRate(prior5)

  const impulsiveRecent = recent5.filter((t) =>
    /fomo|revenge|anxious|euphoric|tilted/i.test(t.emotion || ""),
  ).length
  const resilience = clamp(
    72 - impulsiveRecent * 14 + (context.emotionalState.trend === "stable" ? 10 : 0),
  )

  const confidenceEvolution = clamp(
    context.cognitive?.state.confidence ??
      context.tradingOs?.evolution.overallEvolutionScore ??
      winRate5,
  )

  const decisionConsistency = clamp(
    context.tradingOs?.evolution.disciplineTrend.current ?? disciplineCurrent,
  )

  const selfAwareness = clamp(
    (context.compressedMemories.length > 0 ? 15 : 0) +
      (context.autonomous?.recentLessons.length ?? 0) * 8 +
      (context.cognitive?.confidenceGraph.fakeConfidence ? -10 : 12) +
      45,
  )

  const dimensions: IdentityDimension[] = [
    {
      key: "confidence",
      label: "Confidence evolution",
      score: confidenceEvolution,
      trend: trend(confidenceEvolution - winRatePrior),
      narrative:
        confidenceEvolution >= 70
          ? "Confidence is calibrated — verify it with checklist, not P&L."
          : "Confidence rebuilding — prioritize process wins.",
    },
    {
      key: "discipline",
      label: "Discipline identity",
      score: disciplineCurrent,
      trend: trend(disciplineCurrent - disciplinePrior),
      narrative:
        disciplineCurrent >= 70
          ? "You are becoming a rule-first trader."
          : "Discipline identity still forming — one clean trade at a time.",
    },
    {
      key: "resilience",
      label: "Emotional resilience",
      score: resilience,
      trend: trend(resilience - (impulsiveRecent > 1 ? -12 : 8)),
      narrative:
        resilience >= 65
          ? "Recovery from setbacks is improving."
          : "Emotional rebounds are slow — protect mornings and size.",
    },
    {
      key: "consistency",
      label: "Decision consistency",
      score: decisionConsistency,
      trend: trend(decisionConsistency - disciplinePrior),
      narrative: "Consistency is the bridge between identity and results.",
    },
    {
      key: "awareness",
      label: "Self-awareness growth",
      score: selfAwareness,
      trend: selfAwareness >= 60 ? "rising" : "stable",
      narrative:
        selfAwareness >= 65
          ? "You name patterns before they trade you."
          : "More journaling will accelerate self-awareness.",
    },
  ]

  const overallMaturity = clamp(
    dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length,
  )

  const archetype =
    context.autonomous?.traderDna.archetype ??
    (disciplineCurrent >= 70 ? "Process architect" : "Evolving operator")

  const becoming =
    overallMaturity >= 75
      ? "A disciplined decision-maker who uses the market as feedback, not validation."
      : overallMaturity >= 55
        ? "Someone learning to separate identity from individual trades."
        : "A trader building awareness before scaling risk."

  return {
    archetype,
    becoming,
    dimensions,
    overallMaturity,
  }
}
