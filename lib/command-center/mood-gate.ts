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
    if (message.payload.moodGateSuppressed === true) return true
    const decision = message.payload.decision as TradeDecisionPayload | undefined
    const verdictReasoning = decision?.weightedConfidence?.verdictReasoning
    if (!verdictReasoning) return false
    return resolveMoodAtAnalysis(message.payload) === undefined
  })
}

/** Strip trader verdict layers from analyses that predate today's mood check-in. */
export function sanitizeCompanionMessagePayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const moodAt = resolveMoodAtAnalysis(payload)
  if (moodAt !== undefined && moodAt) return payload

  const decision = payload.decision
  if (!decision || typeof decision !== "object") return payload

  const raw = decision as TradeDecisionPayload & Record<string, unknown>
  if (!raw.weightedConfidence?.verdictReasoning) return payload

  return {
    ...payload,
    moodGateSuppressed: true,
    decision: {
      ...raw,
      recommendation: "CAUTION",
      weightedConfidence: {
        ...raw.weightedConfidence,
        verdict: "CAUTION",
        verdictReasoning: null,
      },
    },
  }
}

export function sanitizeCompanionMessage(
  message: CommandCenterMessageRecord,
): CommandCenterMessageRecord {
  if (message.role !== "assistant" || message.message_type !== "analysis") return message
  return {
    ...message,
    payload: sanitizeCompanionMessagePayload(message.payload),
  }
}
