import type { ChartVisionInput, ChartVisionProvider, ChartVisionProviderId } from "@/lib/coach/types"
import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import type { TimeframeVisualAnalysis } from "@/lib/coach/visual-analysis-types"
import type { StrategyPlaybookRecord } from "@/lib/strategy/types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import { heuristicVisionProvider } from "@/lib/coach/vision-adapters/heuristic-adapter"
import { claudeProvider } from "@/lib/ai/providers/claude-provider"
import { geminiProvider } from "@/lib/ai/providers/gemini-provider"
import {
  getOpenAiVisionModel,
  isOpenAiConfigured,
  openaiProvider,
} from "@/lib/ai/providers/openai-provider"
import type {
  AiCoachTextInput,
  AiDebriefTextInput,
  AiProvider,
  AiProviderId,
  VisionEngineId,
} from "@/lib/ai/providers/provider-interface"
import { isAiProviderId, normalizeProviderId, visionEngineUsesAi } from "@/lib/ai/providers/provider-interface"

const providers: Record<AiProviderId, AiProvider> = {
  openai: openaiProvider,
  claude: claudeProvider,
  gemini: geminiProvider,
}

export function getConfiguredAiProviderId(): AiProviderId | null {
  const fromAiProvider = normalizeProviderId(process.env.AI_PROVIDER)
  if (fromAiProvider && providers[fromAiProvider]?.isConfigured()) {
    return fromAiProvider
  }

  const legacy = normalizeProviderId(process.env.CHART_VISION_PROVIDER)
  if (legacy && legacy !== "openai" && providers[legacy]?.isConfigured()) {
    return legacy
  }
  if (legacy === "openai" && isOpenAiConfigured()) return "openai"
  if (isOpenAiConfigured()) return "openai"

  for (const id of ["openai", "claude", "gemini"] as AiProviderId[]) {
    if (providers[id].isConfigured()) return id
  }
  return null
}

export function resolveAiProvider(providerId?: AiProviderId | string | null): AiProvider | null {
  const normalized = normalizeProviderId(providerId) || getConfiguredAiProviderId()
  if (!normalized) return null
  return providers[normalized]
}

export function resolveRequestedVisionEngine(): VisionEngineId {
  if (process.env.CHART_VISION_PROVIDER === "heuristic") return "heuristic"
  const configured = getConfiguredAiProviderId()
  return configured || "heuristic"
}

export function isAiProviderConfigured(providerId?: AiProviderId | string | null): boolean {
  const provider = resolveAiProvider(providerId)
  return Boolean(provider?.isConfigured())
}

export function getProviderDisplayLabel(
  engine: VisionEngineId | ChartVisionProviderId | string,
  model?: string | null,
): string {
  if (engine === "heuristic") return "Journal rules"

  const normalized = normalizeProviderId(engine) || (isAiProviderId(engine) ? engine : null)
  const provider = normalized ? providers[normalized] : null
  if (!provider) return "AI Vision"

  if (normalized === "openai") {
    const visionModel = model || getOpenAiVisionModel()
    return visionModel.includes("gpt-4") ? "GPT-4 Vision" : `${provider.label} Vision`
  }

  const visionModel = model || provider.getVisionModel()
  return visionModel ? `${provider.label} · ${visionModel}` : `${provider.label} Vision`
}

export function getVisionModelForEngine(
  engine: VisionEngineId | ChartVisionProviderId | string,
): string | undefined {
  if (engine === "heuristic") return undefined
  const normalized = normalizeProviderId(engine) || (isAiProviderId(engine) ? engine : null)
  if (!normalized || !visionEngineUsesAi(normalized)) return undefined
  return providers[normalized].getVisionModel() || undefined
}

export function toChartVisionProvider(provider: AiProvider): ChartVisionProvider {
  return {
    id: provider.id,
    analyze: (input) => provider.analyzeChartVision(input),
  }
}

export function getChartVisionProviders(): Record<
  Exclude<ChartVisionProviderId, "heuristic">,
  ChartVisionProvider
> {
  return {
    openai: toChartVisionProvider(openaiProvider),
    claude: toChartVisionProvider(claudeProvider),
    gemini: toChartVisionProvider(geminiProvider),
    anthropic: toChartVisionProvider(claudeProvider),
  }
}

export async function analyzeTimeframeWithAiProvider(input: {
  screenshotUrl: string
  plannedContext: PreTradePlannedContext
  timeframe: CoachMtfTimeframe
  playbook?: StrategyPlaybookRecord | null
  providerId?: AiProviderId | string | null
}): Promise<TimeframeVisualAnalysis> {
  const provider = resolveAiProvider(input.providerId)
  if (!provider?.isConfigured()) {
    throw new Error("No AI provider configured")
  }
  return provider.analyzeTimeframeVision(input)
}

export async function analyzeChartVisionWithAiProvider(
  input: ChartVisionInput,
  providerId?: AiProviderId | string | null,
) {
  const provider = resolveAiProvider(providerId ?? input.providerId)
  if (!provider?.isConfigured()) {
    throw new Error("No AI provider configured")
  }
  return provider.analyzeChartVision(input)
}

export async function generateCoachInsightWithProvider(
  input: AiCoachTextInput,
  providerId?: AiProviderId | string | null,
): Promise<string | null> {
  const provider = resolveAiProvider(providerId)
  if (!provider?.isConfigured() || !provider.generateCoachInsight) return null
  try {
    return await provider.generateCoachInsight(input)
  } catch {
    return null
  }
}

export async function generateDebriefNarrativeWithProvider(
  input: AiDebriefTextInput,
  providerId?: AiProviderId | string | null,
): Promise<string | null> {
  const provider = resolveAiProvider(providerId)
  if (!provider?.isConfigured() || !provider.generateDebriefNarrative) return null
  try {
    return await provider.generateDebriefNarrative(input)
  } catch {
    return null
  }
}

export function resolveActualVisionEngine(
  timeframes: Partial<Record<CoachMtfTimeframe, TimeframeVisualAnalysis>>,
  requested: VisionEngineId,
): VisionEngineId {
  const results = Object.values(timeframes).filter(Boolean) as TimeframeVisualAnalysis[]
  if (results.length === 0) return requested

  const aiIds: AiProviderId[] = ["openai", "claude", "gemini"]
  for (const id of aiIds) {
    if (results.every((tf) => tf.provider === id)) return id
  }

  const aiCount = results.filter((tf) => isAiProviderId(tf.provider)).length
  if (aiCount === 0) return "heuristic"
  if (aiCount === results.length && requested !== "heuristic") return requested
  return "heuristic"
}

export function buildVisionFallbackWarnings(input: {
  requestedEngine: VisionEngineId
  timeframes: Partial<Record<CoachMtfTimeframe, TimeframeVisualAnalysis>>
  lastError?: string | null
}): string[] {
  if (input.requestedEngine === "heuristic") return []

  const provider = resolveAiProvider(input.requestedEngine)
  if (!provider?.isConfigured()) {
    return [
      `${provider?.label || "AI"} is not configured — set AI_PROVIDER and the provider API key in .env.local, then restart the dev server.`,
    ]
  }

  const results = Object.values(input.timeframes).filter(Boolean) as TimeframeVisualAnalysis[]
  const heuristicCount = results.filter((tf) => tf.provider === "heuristic").length
  if (heuristicCount === 0) return []

  const label = getProviderDisplayLabel(input.requestedEngine)

  if (input.lastError?.includes("429") || input.lastError?.toLowerCase().includes("quota")) {
    return [
      `${label} unavailable — quota or billing issue. Analysis used the heuristic engine instead.`,
    ]
  }

  return [
    `${label} failed for ${heuristicCount}/${results.length} chart(s) — using heuristic fallback. Check server logs for details.`,
  ]
}

export { openaiProvider, claudeProvider, geminiProvider, heuristicVisionProvider }
export { isOpenAiConfigured, getOpenAiVisionModel }
export type { AiProvider, AiProviderId, VisionEngineId }

/** @deprecated use isOpenAiConfigured */
export const isOpenAiVisionConfigured = isOpenAiConfigured

/** @deprecated use analyzeTimeframeWithAiProvider */
export async function analyzeTimeframeWithOpenAi(input: {
  screenshotUrl: string
  plannedContext: PreTradePlannedContext
  timeframe: CoachMtfTimeframe
  playbook?: StrategyPlaybookRecord | null
}) {
  return analyzeTimeframeWithAiProvider({ ...input, providerId: "openai" })
}
