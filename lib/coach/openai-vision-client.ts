import OpenAI from "openai"
import {
  getOpenAiClient,
  getOpenAiVisionModel,
  isOpenAiConfigured,
} from "@/lib/ai/providers/openai-provider"

/** @deprecated import from @/lib/ai/providers instead */
export function getOpenAiVisionClient(): OpenAI | null {
  return getOpenAiClient()
}

/** @deprecated import from @/lib/ai/providers instead */
export { getOpenAiVisionModel, isOpenAiConfigured as isOpenAiVisionConfigured }
