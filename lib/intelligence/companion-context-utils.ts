import type { CommandCenterMessageRecord, CommandCenterWarning } from "@/lib/command-center/types"
import type { CompanionConversationalState } from "@/lib/intelligence/conversational-types"
import type { TraderContextMemory } from "@/lib/intelligence/trader-context"
import { extractMentionedWarningIds, filterFreshWarnings } from "@/lib/intelligence/conversation-continuity"
import { resolveCompanionState } from "@/lib/intelligence/conversational-state-engine"

export function resolveCompanionStateFromThread(
  messages: CommandCenterMessageRecord[],
  memory: TraderContextMemory,
): CompanionConversationalState {
  const today = new Date().toISOString().slice(0, 10)

  const todayGreeting = [...messages]
    .reverse()
    .find((m) => m.message_type === "greeting" && m.payload?.dayKey === today)

  if (todayGreeting?.payload?.companionState) {
    const state = todayGreeting.payload.companionState
    if (
      state === "calm" ||
      state === "analytical" ||
      state === "warning" ||
      state === "protective" ||
      state === "confident" ||
      state === "reflective"
    ) {
      return state
    }
  }

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.payload?.companionState)

  if (lastAssistant?.payload?.companionState) {
    const state = lastAssistant.payload.companionState
    if (
      state === "calm" ||
      state === "analytical" ||
      state === "warning" ||
      state === "protective" ||
      state === "confident" ||
      state === "reflective"
    ) {
      return state
    }
  }

  return resolveCompanionState(memory)
}

export function getFreshWarnings(
  warnings: CommandCenterWarning[],
  messages: CommandCenterMessageRecord[],
): CommandCenterWarning[] {
  const mentioned = extractMentionedWarningIds(messages)
  return filterFreshWarnings(warnings, mentioned)
}

export function greetingWarningIds(memory: TraderContextMemory): string[] {
  const state = resolveCompanionState(memory)
  if (state !== "warning" && state !== "protective") return []

  return memory.warnings
    .filter((w) => w.severity === "critical" || w.source === "pattern" || w.source === "leak")
    .map((w) => w.id)
}
