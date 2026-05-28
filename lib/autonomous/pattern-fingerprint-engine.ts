import { parseMistakeTags } from "@/lib/trade-form-config"
import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import type {
  PatternFingerprintCluster,
  PatternMatchResult,
} from "@/lib/autonomous/types"

function clusterKey(parts: string[]): string {
  return parts.filter(Boolean).join("|").toLowerCase().replace(/\s+/g, "_")
}

function fingerprintFromTrade(trade: FullTraderContext["recentTrades"][number]): Record<string, unknown> {
  return {
    pair: trade.pair,
    direction: trade.direction,
    session: trade.session,
    emotion: trade.emotion,
    result: trade.result,
    setup: (trade as { setup?: string }).setup ?? null,
    tags: parseMistakeTags((trade as { mistake_tags?: string }).mistake_tags),
  }
}

/**
 * Build pattern memory clusters from journal history.
 */
export function buildPatternFingerprintClusters(
  context: FullTraderContext,
): PatternFingerprintCluster[] {
  const clusters: PatternFingerprintCluster[] = []
  const trades = context.recentTrades

  const wins = trades.filter((t) => t.result === "WIN")
  const losses = trades.filter((t) => t.result === "LOSS")
  const impulsive = trades.filter((t) =>
    /fomo|revenge|tilted|impulsive|anxious/i.test(String(t.emotion || "")),
  )
  const aPlus = trades.filter(
    (t) =>
      t.result === "WIN" &&
      (t as { rule_followed?: boolean }).rule_followed !== false &&
      !parseMistakeTags((t as { mistake_tags?: string }).mistake_tags).length,
  )

  if (wins.length >= 2) {
    const key = clusterKey(["win", wins[0].pair, wins[0].session || "any"])
    clusters.push({
      clusterKey: key,
      clusterType: "win",
      label: `Winning ${wins[0].pair} in ${wins[0].session || "session"}`,
      occurrenceCount: wins.length,
      avgRr: null,
      matchScoreBaseline: 68,
      fingerprint: fingerprintFromTrade(wins[0]),
    })
  }

  if (losses.length >= 2) {
    const key = clusterKey(["loss", losses[0].pair, losses[0].emotion || "neutral"])
    clusters.push({
      clusterKey: key,
      clusterType: "loss",
      label: `Loss cluster: ${losses[0].pair} / ${losses[0].emotion || "neutral emotion"}`,
      occurrenceCount: losses.length,
      avgRr: null,
      matchScoreBaseline: 55,
      fingerprint: fingerprintFromTrade(losses[0]),
    })
  }

  if (impulsive.length >= 2) {
    clusters.push({
      clusterKey: "emotional_breakdown|impulsive",
      clusterType: "emotional_breakdown",
      label: "Emotional breakdown trades",
      occurrenceCount: impulsive.length,
      avgRr: null,
      matchScoreBaseline: 72,
      fingerprint: fingerprintFromTrade(impulsive[0]),
    })
  }

  if (aPlus.length >= 1) {
    clusters.push({
      clusterKey: clusterKey(["a_plus", aPlus[0].pair, aPlus[0].session || "any"]),
      clusterType: "a_plus_execution",
      label: `A+ execution: ${aPlus[0].pair}`,
      occurrenceCount: aPlus.length,
      avgRr: null,
      matchScoreBaseline: 80,
      fingerprint: fingerprintFromTrade(aPlus[0]),
    })
  }

  return clusters
}

function similarity(
  live: Record<string, unknown>,
  stored: Record<string, unknown>,
): number {
  let score = 40
  if (live.pair === stored.pair) score += 22
  if (live.direction === stored.direction) score += 12
  if (live.session && live.session === stored.session) score += 18
  if (live.emotion && live.emotion === stored.emotion) score += 10
  return Math.min(95, score)
}

/**
 * Compare live planned setup against stored fingerprint clusters.
 */
export function matchLiveSetupToFingerprints(input: {
  context: FullTraderContext
  plannedContext?: PreTradePlannedContext | null
  clusters?: PatternFingerprintCluster[]
}): PatternMatchResult {
  const clusters = input.clusters ?? buildPatternFingerprintClusters(input.context)
  const planned = input.plannedContext ?? input.context.activePlannedContext

  if (!planned || clusters.length === 0) {
    return { bestMatch: null, similarityScore: 0, narrative: null }
  }

  const live: Record<string, unknown> = {
    pair: planned.pair,
    direction: planned.direction,
    session: planned.session,
    emotion: planned.emotion,
    setup: planned.setup,
  }

  let best: PatternFingerprintCluster | null = null
  let bestScore = 0

  for (const cluster of clusters) {
    const fp = cluster.fingerprint as Record<string, unknown>
    const score = similarity(live, fp)
    if (score > bestScore) {
      bestScore = score
      best = cluster
    }
  }

  if (!best || bestScore < 52) {
    return { bestMatch: null, similarityScore: bestScore, narrative: null }
  }

  const narrative =
    best.clusterType === "win"
      ? `Live setup resembles your winning ${best.label} cluster (${bestScore}% match).`
      : best.clusterType === "loss"
        ? `Caution: resembles your ${best.label} loss cluster (${bestScore}% match).`
        : best.clusterType === "emotional_breakdown"
          ? `Matches emotional breakdown pattern (${bestScore}%) — pause and reset.`
          : `Aligns with A+ execution memory (${bestScore}% match).`

  return { bestMatch: best, similarityScore: bestScore, narrative }
}
