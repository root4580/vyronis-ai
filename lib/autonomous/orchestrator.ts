import { evaluateShadowMode } from "@/lib/autonomous/shadow-mode-engine"
import { computeTraderDna } from "@/lib/autonomous/trader-dna-engine"
import { evaluateSessionIntelligence } from "@/lib/autonomous/session-intelligence-engine"
import {
  buildPatternFingerprintClusters,
  matchLiveSetupToFingerprints,
} from "@/lib/autonomous/pattern-fingerprint-engine"
import type {
  AutonomousEngineInput,
  AutonomousIntelligenceSnapshot,
  ProactiveNudge,
} from "@/lib/autonomous/types"

function buildProactiveNudges(input: {
  shadow: AutonomousIntelligenceSnapshot["shadow"]
  session: AutonomousIntelligenceSnapshot["session"]
  patternMatch: AutonomousIntelligenceSnapshot["patternMatch"]
  dna: AutonomousIntelligenceSnapshot["traderDna"]
}): ProactiveNudge[] {
  const nudges: ProactiveNudge[] = []

  if (input.shadow.shouldPause || input.shadow.overallRiskLevel === "critical") {
    nudges.push({
      id: "shadow-pause",
      priority: "high",
      message: input.shadow.proactiveMessage,
      source: "shadow",
    })
  } else if (input.shadow.overallRiskLevel === "elevated") {
    nudges.push({
      id: "shadow-elevated",
      priority: "medium",
      message: input.shadow.proactiveMessage,
      source: "shadow",
    })
  }

  if (input.session.marketContext !== "neutral") {
    nudges.push({
      id: `session-${input.session.marketContext}`,
      priority: "low",
      message: input.session.narrative,
      source: "session",
    })
  }

  if (input.patternMatch.narrative && (input.patternMatch.similarityScore ?? 0) >= 60) {
    nudges.push({
      id: "pattern-match",
      priority:
        input.patternMatch.bestMatch?.clusterType === "loss" ||
        input.patternMatch.bestMatch?.clusterType === "emotional_breakdown"
          ? "high"
          : "medium",
      message: input.patternMatch.narrative,
      source: "pattern",
    })
  }

  if (input.dna.weeklyInsight && input.dna.recurringMistakes[0]) {
    nudges.push({
      id: "dna-weekly",
      priority: "low",
      message: input.dna.weeklyInsight,
      source: "dna",
    })
  }

  return nudges.slice(0, 4)
}

/**
 * Orchestration layer — composes vision/reasoning/memory/psychology/scoring outputs.
 * Vision & reasoning remain in command-center engines; this layer unifies trader OS signals.
 */
export function buildAutonomousIntelligenceSnapshot(
  input: AutonomousEngineInput,
): AutonomousIntelligenceSnapshot {
  const { context, plannedContext } = input
  const shadow = evaluateShadowMode({ context, plannedContext })
  const traderDna = computeTraderDna(context)
  const session = evaluateSessionIntelligence(context)
  const clusters = buildPatternFingerprintClusters(context)
  const patternMatch = matchLiveSetupToFingerprints({
    context,
    plannedContext,
    clusters,
  })

  const recentLessons = context.compressedMemories
    .filter((m) => m.category === "dangerous_pattern" || m.category === "repeated_behavior")
    .slice(0, 3)
    .map((m) => m.insight)

  const proactiveNudges = buildProactiveNudges({ shadow, session, patternMatch, dna: traderDna })

  return {
    computedAt: new Date().toISOString(),
    shadow,
    traderDna,
    session,
    patternClusters: clusters,
    patternMatch,
    recentLessons,
    proactiveNudges,
    capabilities: {
      voice: "planned",
      mobile: "planned",
      tradingViewLive: "planned",
      mt5: "partial",
      streamingReplies: "active",
      realtimeCoaching: "partial",
      aiReplay: "active",
    },
  }
}
