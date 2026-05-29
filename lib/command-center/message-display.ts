import type { CommandCenterMessageRecord } from "@/lib/command-center/types"

function assistantDedupeKey(message: CommandCenterMessageRecord): string {
  const type = message.message_type ?? "text"
  const content = message.content.trim().replace(/\s+/g, " ")
  return `${type}:${content}`
}

export function dedupeAssistantMessagesByContent(
  messages: CommandCenterMessageRecord[],
): CommandCenterMessageRecord[] {
  const seen = new Set<string>()
  return messages.filter((message) => {
    if (message.role !== "assistant") return true
    const key = assistantDedupeKey(message)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function filterMessagesForStreaming(
  messages: CommandCenterMessageRecord[],
  streamingMessage: CommandCenterMessageRecord | null | undefined,
): CommandCenterMessageRecord[] {
  if (!streamingMessage) return messages
  const streamKey = assistantDedupeKey(streamingMessage)
  return messages.filter((message) => {
    if (message.id === streamingMessage.id) return false
    if (message.role !== "assistant" || streamingMessage.role !== "assistant") return true
    return assistantDedupeKey(message) !== streamKey
  })
}

/** Keep only the latest chart analysis bubble; older analyses go to history. */
export function partitionCompanionMessages(messages: CommandCenterMessageRecord[]): {
  visible: CommandCenterMessageRecord[]
  history: CommandCenterMessageRecord[]
} {
  const deduped = dedupeAssistantMessagesByContent(messages)

  const analysis = deduped.filter(
    (m) => m.role === "assistant" && m.message_type === "analysis",
  )
  if (analysis.length <= 1) {
    return { visible: deduped, history: [] }
  }

  const latest = analysis[analysis.length - 1]
  const historyIds = new Set(analysis.slice(0, -1).map((m) => m.id))
  const visible = deduped.filter((m) => !historyIds.has(m.id))
  const history = deduped.filter((m) => historyIds.has(m.id))
  return { visible, history }
}
