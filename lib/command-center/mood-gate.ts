import type { CommandCenterMessageRecord } from "@/lib/command-center/types"
import type { VerdictReasoning } from "@/lib/intelligence/verdict-reasoning-engine"

type TradeDecisionPayload = {
  weightedConfidence?: {
    verdictReasoning?: VerdictReasoning
  }
}

export function resolveMoodAtAnalysis(
  payload: Record<string, unknown>,
): string | null | undefined {
  if (!("sessionMoodAtAnalysis" in payload)) return undefined
  const raw = payload.sessionMoodAtAnalysis
  return typeof raw === "string" ? raw.trim() || null : null
}

export function canShowTraderVerdictCard(input: {
  verdictReasoning?: VerdictReasoning | null
  moodAtAnalysis?: string | null
}): boolean {
  if (!input.verdictReasoning) return false
  if (input.moodAtAnalysis === undefined) return false
  return Boolean(input.moodAtAnalysis?.trim())
}

export function threadHasLegacyChartVerdict(
  messages: CommandCenterMessageRecord[],
): boolean {
  return messages.some((message) => {
    if (message.role !== "assistant" || message.message_type !== "analysis") return false
    const decision = message.payload.decision as TradeDecisionPayload | undefined
    const verdictReasoning = decision?.weightedConfidence?.verdictReasoning
    if (!verdictReasoning) return false
    return resolveMoodAtAnalysis(message.payload) === undefined
  })
}
