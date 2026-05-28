import type { CognitiveStateSnapshot } from "@/lib/cognitive/types"

export type TrendDirection = "improving" | "declining" | "stable"

export type TraderStateTimelineSnapshot = {
  sampleCount: number
  /** Average verdict strictness over recent snapshots */
  avgStrictness: number
  strictnessDelta: number | null
  /** Average stability score */
  avgStability: number
  stabilityTrend: TrendDirection
  processHealthTrend: TrendDirection
  emotionalDriftTrend: TrendDirection
  primaryStateMode: string | null
  narrative: string
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function trendFromDelta(delta: number | null): TrendDirection {
  if (delta == null) return "stable"
  if (delta >= 6) return "declining"
  if (delta <= -6) return "improving"
  return "stable"
}

type SnapshotRow = {
  snapshot: Record<string, unknown>
  created_at: string
}

function parseCognitiveSnapshot(row: SnapshotRow): Partial<CognitiveStateSnapshot> | null {
  const s = row.snapshot?.state ?? row.snapshot
  if (!s || typeof s !== "object") return null
  const state = s as Record<string, unknown>
  return {
    primary: state.primary as CognitiveStateSnapshot["primary"],
    verdictStrictness:
      typeof state.verdictStrictness === "number" ? state.verdictStrictness : undefined,
    stability: typeof state.stability === "number" ? state.stability : undefined,
    riskPermission: typeof state.riskPermission === "number" ? state.riskPermission : undefined,
  }
}

export function buildTraderStateTimeline(
  rows: SnapshotRow[],
  liveDriftScore?: number,
): TraderStateTimelineSnapshot {
  const parsed = rows
    .map(parseCognitiveSnapshot)
    .filter((s): s is Partial<CognitiveStateSnapshot> => Boolean(s))

  if (parsed.length === 0) {
    return {
      sampleCount: 0,
      avgStrictness: 55,
      strictnessDelta: null,
      avgStability: 60,
      stabilityTrend: "stable",
      processHealthTrend: "stable",
      emotionalDriftTrend:
        liveDriftScore != null && liveDriftScore >= 60 ? "declining" : "stable",
      primaryStateMode: null,
      narrative: "Building your state timeline — check back after a few sessions.",
    }
  }

  const strictness = parsed
    .map((s) => s.verdictStrictness)
    .filter((n): n is number => typeof n === "number")
  const stabilities = parsed
    .map((s) => s.stability)
    .filter((n): n is number => typeof n === "number")

  const avgStrictness = clamp(
    strictness.reduce((a, b) => a + b, 0) / Math.max(strictness.length, 1),
  )
  const avgStability = clamp(
    stabilities.reduce((a, b) => a + b, 0) / Math.max(stabilities.length, 1),
  )

  const recentStrict = strictness.slice(0, 3)
  const olderStrict = strictness.slice(3, 6)
  const strictnessDelta =
    recentStrict.length > 0 && olderStrict.length > 0
      ? Math.round(
          recentStrict.reduce((a, b) => a + b, 0) / recentStrict.length -
            olderStrict.reduce((a, b) => a + b, 0) / olderStrict.length,
        )
      : null

  const recentStab = stabilities.slice(0, 3)
  const olderStab = stabilities.slice(3, 6)
  const stabilityDelta =
    recentStab.length > 0 && olderStab.length > 0
      ? Math.round(
          recentStab.reduce((a, b) => a + b, 0) / recentStab.length -
            olderStab.reduce((a, b) => a + b, 0) / olderStab.length,
        )
      : null

  const primaryCounts = new Map<string, number>()
  for (const s of parsed) {
    if (s.primary) primaryCounts.set(s.primary, (primaryCounts.get(s.primary) ?? 0) + 1)
  }
  const primaryStateMode =
    [...primaryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const stabilityTrend = trendFromDelta(stabilityDelta)
  const processHealthTrend =
    stabilityTrend === "improving" && (strictnessDelta ?? 0) <= 0
      ? "improving"
      : stabilityTrend === "declining" || (strictnessDelta ?? 0) > 8
        ? "declining"
        : "stable"

  const emotionalDriftTrend: TrendDirection =
    liveDriftScore != null && liveDriftScore >= 65
      ? "declining"
      : liveDriftScore != null && liveDriftScore <= 35
        ? "improving"
        : trendFromDelta(strictnessDelta)

  const narrative =
    processHealthTrend === "improving"
      ? "Your process discipline is trending up over recent sessions."
      : processHealthTrend === "declining"
        ? "Protective mode warranted — recent sessions show rising strictness or drift."
        : `State mode: ${primaryStateMode?.replace(/_/g, " ") ?? "mixed"} — holding steady.`

  return {
    sampleCount: parsed.length,
    avgStrictness,
    strictnessDelta,
    avgStability,
    stabilityTrend,
    processHealthTrend,
    emotionalDriftTrend,
    primaryStateMode,
    narrative,
  }
}
