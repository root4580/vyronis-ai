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
    "Gemini provider is not configured yet. Set GEMINI_API_KEY and implement gemini-provider when ready.",
  )
}

export function getGeminiVisionModel(): string {
  return process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.0-flash"
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim())
}

/** Future-ready Gemini adapter — wire Google Generative AI SDK here. */
export const geminiProvider: AiProvider = {
  id: "gemini",
  label: "Gemini",
  capabilities: { vision: true, text: true },
  isConfigured: isGeminiConfigured,
  getVisionModel: getGeminiVisionModel,
  async analyzeTimeframeVision(_input: AiVisionTimeframeInput) {
    if (!isGeminiConfigured()) notConfigured()
    notConfigured()
  },
  async analyzeChartVision(_input: ChartVisionInput) {
    if (!isGeminiConfigured()) notConfigured()
    notConfigured()
  },
  async completeText(_input: AiTextCompletionInput) {
    if (!isGeminiConfigured()) notConfigured()
    notConfigured()
  },
  async generateCoachInsight(_input: AiCoachTextInput) {
    if (!isGeminiConfigured()) return null
    return null
  },
  async generateDebriefNarrative(_input: AiDebriefTextInput) {
    if (!isGeminiConfigured()) return null
    return null
  },
}
