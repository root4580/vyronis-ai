import type { CommandCenterVisionAnalysis } from "@/lib/intelligence/command-center-vision-engine"
import { evaluateMarketEnvironment } from "@/lib/cognitive/market-environment-engine"
import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type { MarketEnvironmentLabel } from "@/lib/cognitive/types"

export type VisionQualityLabel = "tradeable" | "mixed" | "low_quality"

export type VisionIntelligenceSnapshot = {
  available: boolean
  quality: VisionQualityLabel
  visionScore: number
  structureRead: string
  environmentLabels: MarketEnvironmentLabel[]
  tradingBias: string
  aoiQuality: string | null
  entryTiming: string | null
  htfAlignment: string | null
  checklistHighlights: string[]
  narrative: string
  /** Phase 7 prep — future: BOS/CHOCH/sweep confidence */
  structureConfidence: number
}

function qualityFromScore(score: number): VisionQualityLabel {
  if (score >= 68) return "tradeable"
  if (score >= 48) return "mixed"
  return "low_quality"
}

/**
 * Phase 7 vision intelligence facade — unifies bundle/single vision reads
 * without duplicating analysis pipelines.
 */
export function buildVisionIntelligenceSnapshot(input: {
  context: FullTraderContext
  chartVision?: CommandCenterVisionAnalysis | null
}): VisionIntelligenceSnapshot | null {
  const { chartVision } = input
  if (!chartVision?.available) return null

  const bundle = chartVision.bundle
  const vision = chartVision.vision
  const marketEnv = evaluateMarketEnvironment({
    context: input.context,
    chartVision,
  })

  const visionScore =
    bundle?.mtfAnalysis?.visionScore ??
    vision?.visionScore ??
    50

  const structureRead = bundle
    ? `${bundle.inferredStack} · ${bundle.structureType} · HTF ${bundle.htfAlignment}`
    : `${vision?.detectedSetup ?? "setup"} · ${vision?.metrics?.trendDirection ?? "neutral"}`

  const checklistHighlights = chartVision.checklist
    .filter((c) => c.status === "warn")
    .slice(0, 3)
    .map((c) => `${c.label}: ${c.value}`)

  if (checklistHighlights.length === 0) {
    chartVision.checklist
      .filter((c) => c.status === "good")
      .slice(0, 2)
      .forEach((c) => checklistHighlights.push(`${c.label}: ${c.value}`))
  }

  const structureConfidence = clamp(
    visionScore * 0.6 +
      (bundle?.ltfConfirmsHtf ? 25 : bundle?.htfAlignment === "aligned" ? 15 : 0) +
      (vision?.metrics?.confirmationCandleQuality ?? 50) * 0.15,
  )

  const narrative = [
    `Vision quality: ${qualityFromScore(visionScore)} (${visionScore}/100).`,
    structureRead,
    marketEnv.tradingBias,
    checklistHighlights[0],
  ]
    .filter(Boolean)
    .join(" ")

  return {
    available: true,
    quality: qualityFromScore(visionScore),
    visionScore,
    structureRead,
    environmentLabels: marketEnv.labels,
    tradingBias: marketEnv.tradingBias,
    aoiQuality: bundle?.aoiQuality ?? null,
    entryTiming: bundle?.entryTiming ?? null,
    htfAlignment: bundle?.htfAlignment ?? null,
    checklistHighlights,
    narrative,
    structureConfidence,
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}
