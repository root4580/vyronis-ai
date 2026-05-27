import type { ChartVisionInput } from "@/lib/coach/types"
import type {
  AiCoachTextInput,
  AiDebriefTextInput,
  AiProvider,
  AiTextCompletionInput,
  AiVisionTimeframeInput,
} from "@/lib/ai/providers/provider-interface"

function notConfigured(): never {
  throw new Error(
    "Claude provider is not configured yet. Set ANTHROPIC_API_KEY and implement claude-provider when ready.",
  )
}

export function getClaudeVisionModel(): string {
  return process.env.CLAUDE_VISION_MODEL?.trim() || "claude-sonnet-4-20250514"
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

/** Future-ready Claude adapter — wire Anthropic SDK here. */
export const claudeProvider: AiProvider = {
  id: "claude",
  label: "Claude",
  capabilities: { vision: true, text: true },
  isConfigured: isClaudeConfigured,
  getVisionModel: getClaudeVisionModel,
  async analyzeTimeframeVision(_input: AiVisionTimeframeInput) {
    if (!isClaudeConfigured()) notConfigured()
    notConfigured()
  },
  async analyzeChartVision(_input: ChartVisionInput) {
    if (!isClaudeConfigured()) notConfigured()
    notConfigured()
  },
  async completeText(_input: AiTextCompletionInput) {
    if (!isClaudeConfigured()) notConfigured()
    notConfigured()
  },
  async generateCoachInsight(_input: AiCoachTextInput) {
    if (!isClaudeConfigured()) return null
    return null
  },
  async generateDebriefNarrative(_input: AiDebriefTextInput) {
    if (!isClaudeConfigured()) return null
    return null
  },
}
