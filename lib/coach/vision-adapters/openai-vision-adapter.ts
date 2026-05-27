import type { ChartVisionProvider } from "@/lib/coach/types"
import { openaiProvider } from "@/lib/ai/providers/openai-provider"
import type { AiVisionTimeframeInput } from "@/lib/ai/providers/provider-interface"
import type { TimeframeVisualAnalysis } from "@/lib/coach/visual-analysis-types"

/** Delegates to the OpenAI provider — prefer @/lib/ai/providers directly. */
export async function analyzeTimeframeWithOpenAi(
  input: AiVisionTimeframeInput,
): Promise<TimeframeVisualAnalysis> {
  return openaiProvider.analyzeTimeframeVision(input)
}

export const openaiVisionProvider: ChartVisionProvider = {
  id: "openai",
  analyze: (input) => openaiProvider.analyzeChartVision(input),
}
