import type {
  CommandCenterContext,
  CommandCenterMessageRecord,
  CommandCenterMode,
} from "@/lib/command-center/types"
import type { TradeDecisionResult } from "@/lib/intelligence/intelligence-types"

export async function fetchCommandCenterContext(
  mode: CommandCenterMode = "companion",
  focusId?: string | null,
): Promise<CommandCenterContext> {
  const params = new URLSearchParams({ mode })
  if (focusId) params.set("focusId", focusId)

  const response = await fetch(`/api/command-center/context?${params.toString()}`, {
    method: "GET",
    credentials: "include",
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Failed to load command center context")
  }

  return payload as CommandCenterContext
}

export async function switchCommandCenterMode(input: {
  mode: CommandCenterMode
  focusId?: string | null
  label?: string
  direction?: "enter" | "exit"
}): Promise<CommandCenterContext> {
  const response = await fetch("/api/command-center/mode", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Failed to switch command center mode")
  }

  return payload as CommandCenterContext
}

export async function sendCommandCenterChat(input: {
  content: string
  mode?: CommandCenterMode
  focusId?: string | null
}): Promise<{
  userMessage: CommandCenterMessageRecord
  assistantMessage: CommandCenterMessageRecord
  context: CommandCenterContext
  thinkingPhases: string[]
  engine: "llm" | "heuristic"
  decision?: TradeDecisionResult
}> {
  const response = await fetch("/api/command-center/chat", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Failed to send message")
  }

  return payload
}

/** @deprecated Prefer sendCommandCenterChat */
export async function sendCommandCenterMessage(content: string): Promise<{
  userMessage: CommandCenterMessageRecord
  assistantMessage: CommandCenterMessageRecord
  context: CommandCenterContext
  thinkingPhases: string[]
}> {
  const result = await sendCommandCenterChat({ content })
  return {
    userMessage: result.userMessage,
    assistantMessage: result.assistantMessage,
    context: result.context,
    thinkingPhases: result.thinkingPhases,
  }
}
