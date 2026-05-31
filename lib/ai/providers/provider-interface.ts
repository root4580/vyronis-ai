import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import type {
  ChartVisionInput,
  ChartVisionProviderId,
  ChartVisionResult,
} from "@/lib/coach/types"
import type { TimeframeVisualAnalysis } from "@/lib/coach/visual-analysis-types"
import type { StrategyPlaybookRecord } from "@/lib/strategy/types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

/** Configurable LLM backends (set via AI_PROVIDER). */
export type AiProviderId = "openai" | "claude" | "gemini"

/** Runtime vision engine id — includes heuristic fallback. */
export type VisionEngineId = AiProviderId | "heuristic"

export type AiProviderCapabilities = {
  vision: boolean
  text: boolean
}

export type AiVisionTimeframeInput = {
  screenshotUrl: string
  plannedContext: PreTradePlannedContext
  timeframe: CoachMtfTimeframe
  playbook?: StrategyPlaybookRecord | null
}

export type AiTextCompletionInput = {
  systemPrompt?: string
  userPrompt: string
  jsonMode?: boolean
  maxTokens?: number
  temperature?: number
}

export type AiCoachTextInput = {
  context: PreTradePlannedContext
  prompt: string
  systemPrompt?: string
  jsonMode?: boolean
}

export type AiDebriefTextInput = {
  summary: string
  tradeCount: number
  winRate: number
  recurringMistakes: string[]
  prompt?: string
}

export interface AiProvider {
  id: AiProviderId
  label: string
  capabilities: AiProviderCapabilities
  isConfigured(): boolean
  getVisionModel(): string | null
  analyzeTimeframeVision(input: AiVisionTimeframeInput): Promise<TimeframeVisualAnalysis>
  analyzeChartVision(input: ChartVisionInput): Promise<ChartVisionResult>
  completeText?(input: AiTextCompletionInput): Promise<string>
  generateCoachInsight?(input: AiCoachTextInput): Promise<string | null>
  generateDebriefNarrative?(input: AiDebriefTextInput): Promise<string | null>
}

export function isVisionEngineId(value: string): value is VisionEngineId {
  return value === "heuristic" || value === "openai" || value === "claude" || value === "gemini"
}

export function isAiProviderId(value: string): value is AiProviderId {
  return value === "openai" || value === "claude" || value === "gemini"
}

/** Maps legacy anthropic id to claude. */
export function normalizeProviderId(value?: string | null): AiProviderId | null {
  const text = String(value || "")
    .trim()
    .toLowerCase()
  if (text === "anthropic") return "claude"
  if (isAiProviderId(text)) return text
  return null
}

export function toChartVisionProviderId(engine: VisionEngineId): ChartVisionProviderId {
  return engine
}

export function visionEngineUsesAi(engine: VisionEngineId): engine is AiProviderId {
  return engine !== "heuristic"
}
