import type { CommandCenterMessageRecord, CommandCenterWarning } from "@/lib/command-center/types"

export function extractMentionedWarningIds(
  messages: CommandCenterMessageRecord[],
): Set<string> {
  const ids = new Set<string>()
  for (const message of messages) {
    if (message.role !== "assistant") continue
    const payloadIds = message.payload?.mentionedWarningIds
    if (Array.isArray(payloadIds)) {
      for (const id of payloadIds) ids.add(String(id))
    }
    const single = message.payload?.warningId
    if (single) ids.add(String(single))
  }
  return ids
}

export function filterFreshWarnings(
  warnings: CommandCenterWarning[],
  mentionedIds: Set<string>,
): CommandCenterWarning[] {
  return warnings.filter((w) => !mentionedIds.has(w.id))
}

export function wasWarningMentionedRecently(
  messages: CommandCenterMessageRecord[],
  warningId: string,
  withinLast = 6,
): boolean {
  const recent = messages.filter((m) => m.role === "assistant").slice(-withinLast)
  return recent.some((m) => {
    const ids = m.payload?.mentionedWarningIds
    if (Array.isArray(ids) && ids.includes(warningId)) return true
    return m.payload?.warningId === warningId
  })
}

export function weaveWarningInline(
  warning: CommandCenterWarning,
  alreadyMentioned: boolean,
): string {
  if (alreadyMentioned) return ""

  if (warning.severity === "critical") {
    return `I need to flag this: ${warning.message}`
  }
  if (warning.source === "pattern") {
    return `I'm noticing a pattern — ${warning.message.toLowerCase()}`
  }
  if (warning.source === "leak") {
    return `Your journal keeps pointing to the same leak: ${warning.message.toLowerCase()}`
  }
  return warning.message
}

export function recentConversationSummary(
  messages: CommandCenterMessageRecord[],
  limit = 4,
): string {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-limit)
    .map((m) => `${m.role}: ${m.content.slice(0, 120)}`)
    .join("\n")
}
