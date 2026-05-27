import type {
  ChartVisionInput,
  ChartVisionProvider,
  ChartVisionProviderId,
  ChartVisionResult,
} from "@/lib/coach/types"
import type { ChartAnalysisResult, PreTradePlannedContext } from "@/lib/trade-coach/types"
import {
  getChartVisionProviders,
  getConfiguredAiProviderId,
  isAiProviderConfigured,
  resolveRequestedVisionEngine,
} from "@/lib/ai/providers"
import { heuristicVisionProvider } from "@/lib/coach/vision-adapters/heuristic-adapter"
import { getCachedChartVision, setCachedChartVision } from "@/lib/coach/vision-cache"

const aiProviders = getChartVisionProviders()

const providers: Record<ChartVisionProviderId, ChartVisionProvider> = {
  heuristic: heuristicVisionProvider,
  openai: aiProviders.openai,
  claude: aiProviders.claude,
  gemini: aiProviders.gemini,
  anthropic: aiProviders.anthropic,
}

export function resolveChartVisionProvider(
  providerId?: ChartVisionProviderId,
): ChartVisionProvider {
  if (providerId === "heuristic") return heuristicVisionProvider

  const envEngine = resolveRequestedVisionEngine()
  if (envEngine === "heuristic" && !providerId) {
    return heuristicVisionProvider
  }

  const selected = providerId || envEngine
  if (selected !== "heuristic" && isAiProviderConfigured(selected)) {
    return providers[selected as ChartVisionProviderId] || heuristicVisionProvider
  }

  const configured = getConfiguredAiProviderId()
  if (configured) {
    return providers[configured] || heuristicVisionProvider
  }

  return heuristicVisionProvider
}

export async function analyzeChartVision(input: ChartVisionInput): Promise<ChartVisionResult> {
  const provider = resolveChartVisionProvider(input.providerId)
  const cached = getCachedChartVision({ ...input, providerId: provider.id })
  if (cached) return cached

  try {
    const result = await provider.analyze(input)
    setCachedChartVision({ ...input, providerId: provider.id }, result)
    return result
  } catch (error) {
    if (provider.id !== "heuristic") {
      const fallback = await heuristicVisionProvider.analyze(input)
      setCachedChartVision({ ...input, providerId: "heuristic" }, fallback)
      return fallback
    }
    throw error
  }
}

export function chartVisionToLegacyAnalysis(vision: ChartVisionResult): ChartAnalysisResult {
  return {
    overallScore: vision.visionScore,
    executionQuality: vision.executionQuality,
    trendAlignment: vision.metrics.emaAlignment,
    confirmationStrength: vision.metrics.confirmationCandleQuality,
    rrQuality: vision.metrics.rrQuality,
    countertrend: vision.metrics.countertrend,
    overextendedEntry: vision.metrics.overextendedMove,
    warnings: vision.warnings,
    strengths: vision.strengths,
    summary: vision.summary,
    insights: vision.insights,
    vision: vision,
  }
}

export function isChartVisionResult(
  value: Partial<ChartVisionResult> | null | undefined,
): value is ChartVisionResult {
  return (
    !!value &&
    value.version === 2 &&
    typeof value.visionScore === "number" &&
    Array.isArray(value.warnings) &&
    Array.isArray(value.strengths) &&
    !!value.metrics
  )
}

export function normalizeChartVision(
  stored: Partial<ChartVisionResult | ChartAnalysisResult> | null | undefined,
  context?: PreTradePlannedContext,
  screenshotUrl?: string | null,
): ChartVisionResult | null {
  if (isChartVisionResult(stored as Partial<ChartVisionResult>)) {
    return stored as ChartVisionResult
  }

  const legacy = stored as Partial<ChartAnalysisResult> | null | undefined
  if (legacy && typeof legacy.overallScore === "number" && legacy.insights) {
    return {
      version: 2,
      visionScore: legacy.overallScore,
      detectedSetup: context?.confirmation_signal || context?.setup || "Chart setup",
      trendBias: legacy.countertrend ? "mixed" : "neutral",
      warnings: legacy.warnings ?? [],
      strengths: legacy.strengths ?? [],
      executionQuality: legacy.executionQuality ?? legacy.overallScore,
      confidence: 60,
      metrics: {
        trendDirection: legacy.countertrend ? "mixed" : "neutral",
        countertrend: legacy.countertrend ?? false,
        rrQuality: legacy.rrQuality ?? 50,
        impulsiveEntryDistance: legacy.overextendedEntry ? 80 : 40,
        emaAlignment: legacy.trendAlignment ?? 50,
        supportResistanceProximity: 55,
        breakoutVsRetest: "unknown",
        confirmationCandleQuality: legacy.confirmationStrength ?? 50,
        overextendedMove: legacy.overextendedEntry ?? false,
        volatilityState: "normal",
      },
      provider: "heuristic",
      analyzedAt: new Date().toISOString(),
      summary: legacy.summary ?? "Chart analysis restored from session.",
      insights: legacy.insights ?? [],
    }
  }

  if (context && screenshotUrl) {
    return null
  }

  return null
}

export function buildChartVisionMessages(vision: ChartVisionResult): string[] {
  const messages = [vision.summary]

  if (vision.detectedSetup) {
    messages.push(`Detected setup: ${vision.detectedSetup}.`)
  }

  if (vision.insights.length > 0) {
    messages.push(`Chart Vision: ${vision.insights.join(" · ")}.`)
  }

  if (vision.warnings.length > 0) {
    messages.push(`Vision warnings: ${vision.warnings.slice(0, 3).join(" · ")}.`)
  }

  messages.push(
    "Quick check next — 2-3 emotion/risk questions, then I'll score trade quality.",
  )

  return messages
}

export async function analyzeChartVisionForContext(
  screenshotUrl: string,
  context: PreTradePlannedContext,
): Promise<{ vision: ChartVisionResult; legacy: ChartAnalysisResult }> {
  const vision = await analyzeChartVision({
    screenshotUrl,
    plannedContext: context,
  })
  return {
    vision,
    legacy: chartVisionToLegacyAnalysis(vision),
  }
}
