import type { CommandCenterMessageRecord } from "@/lib/command-center/types"

/** Keep only the latest chart analysis bubble; older analyses go to history. */
export function partitionCompanionMessages(messages: CommandCenterMessageRecord[]): {
  visible: CommandCenterMessageRecord[]
  history: CommandCenterMessageRecord[]
} {
  const analysis = messages.filter(
    (m) => m.role === "assistant" && m.message_type === "analysis",
  )
  if (analysis.length <= 1) {
    return { visible: messages, history: [] }
  }

  const latest = analysis[analysis.length - 1]
  const historyIds = new Set(analysis.slice(0, -1).map((m) => m.id))
  const visible = messages.filter((m) => !historyIds.has(m.id))
  const history = messages.filter((m) => historyIds.has(m.id))
  return { visible, history }
}
