/**
 * Vyronis AI Router — server-side only.
 * Do not import from client components (API keys must never reach the browser).
 */
import { runClaude, isClaudeConfiguredForVyronis } from "@/lib/ai/providers/claude"
import { runGemini, isGeminiConfiguredForVyronis } from "@/lib/ai/providers/gemini"
import { runOpenAI, isOpenAIConfiguredForVyronis } from "@/lib/ai/providers/openai"
import { buildMockVyronisAIResponse, logProviderError } from "@/lib/ai/providers/vyronis-ai-shared"
import type {
  RunVyronisAIInput,
  VyronisAIProviderId,
  VyronisAIResponse,
  VyronisAITaskType,
} from "@/lib/ai/vyronis-ai-types"

export type {
  RunVyronisAIInput,
  VyronisAIResponse,
  VyronisAITaskType,
  VyronisAIGrade,
} from "@/lib/ai/vyronis-ai-types"

type ProviderRunner = (input: RunVyronisAIInput) => Promise<VyronisAIResponse>

const PROVIDER_RUNNERS: Record<VyronisAIProviderId, ProviderRunner> = {
  openai: runOpenAI,
  claude: runClaude,
  gemini: runGemini,
}

/** Task-specific provider priority chains. */
const TASK_PROVIDER_CHAINS: Record<VyronisAITaskType, VyronisAIProviderId[]> = {
  trading_setup_grading: ["openai", "claude", "gemini"],
  strategy_document_review: ["claude", "openai", "gemini"],
  screenshot_analysis: ["openai", "gemini", "claude"],
  final_summary: ["claude", "openai", "gemini"],
}

function isProviderConfigured(id: VyronisAIProviderId): boolean {
  if (id === "openai") return isOpenAIConfiguredForVyronis()
  if (id === "claude") return isClaudeConfiguredForVyronis()
  return isGeminiConfiguredForVyronis()
}

function getProviderChain(taskType: VyronisAITaskType): VyronisAIProviderId[] {
  return TASK_PROVIDER_CHAINS[taskType]
}

async function runWithProvider(
  providerId: VyronisAIProviderId,
  input: RunVyronisAIInput,
): Promise<VyronisAIResponse> {
  const runner = PROVIDER_RUNNERS[providerId]
  if (!isProviderConfigured(providerId)) {
    return buildMockVyronisAIResponse(`mock-${providerId}`, input.taskType)
  }
  return runner(input)
}

/**
 * Run a Vyronis AI task with automatic provider fallback.
 * Never throws — returns mock data when all providers fail or are unconfigured.
 */
export async function runVyronisAI(input: RunVyronisAIInput): Promise<VyronisAIResponse> {
  const chain = getProviderChain(input.taskType)
  const errors: string[] = []

  for (const providerId of chain) {
    try {
      const result = await runWithProvider(providerId, input)
      if (!result.provider.startsWith("mock-")) {
        return result
      }
      errors.push(`${providerId}: not configured (mock)`)
    } catch (error) {
      logProviderError(providerId, input.taskType, error)
      errors.push(`${providerId}: ${error instanceof Error ? error.message : "failed"}`)
    }
  }

  const backupChain = (["openai", "claude", "gemini"] as VyronisAIProviderId[]).filter(
    (id) => !chain.includes(id),
  )

  for (const providerId of backupChain) {
    try {
      const result = await runWithProvider(providerId, input)
      if (!result.provider.startsWith("mock-")) {
        return {
          ...result,
          warnings: [
            ...result.warnings,
            `Primary providers unavailable — backup ${providerId} used.`,
          ],
        }
      }
    } catch (error) {
      logProviderError(`backup-${providerId}`, input.taskType, error)
    }
  }

  const mockProvider = chain[0] ? `mock-${chain[0]}` : "mock-vyronis"
  return buildMockVyronisAIResponse(mockProvider, input.taskType, {
    warnings: [
      "All AI providers failed or are unconfigured.",
      ...errors.slice(0, 2).map((e) => e.slice(0, 100)),
      "Showing mock analysis so the app keeps working.",
    ],
  })
}

export function getVyronisAIProviderChain(taskType: VyronisAITaskType): VyronisAIProviderId[] {
  return getProviderChain(taskType)
}

export function getConfiguredVyronisAIProviders(): VyronisAIProviderId[] {
  return (["openai", "claude", "gemini"] as VyronisAIProviderId[]).filter(isProviderConfigured)
}
