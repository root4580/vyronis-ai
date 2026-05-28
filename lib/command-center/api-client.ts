import type {
  CommandCenterChatSendInput,
  CommandCenterContext,
  CommandCenterMessageRecord,
  CommandCenterMode,
  CompanionSessionSummary,
} from "@/lib/command-center/types"
import type { TradeDecisionResult } from "@/lib/intelligence/intelligence-types"
import type { CommandCenterVisionAnalysis } from "@/lib/intelligence/command-center-vision-engine"

export async function fetchCommandCenterContext(
  mode: CommandCenterMode = "companion",
  focusId?: string | null,
  sessionId?: string | null,
  options?: { fresh?: boolean },
): Promise<CommandCenterContext> {
  const params = new URLSearchParams({ mode })
  if (focusId) params.set("focusId", focusId)
  if (sessionId) params.set("sessionId", sessionId)
  if (options?.fresh) params.set("fresh", "1")

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

export async function sendCommandCenterChat(
  input: CommandCenterChatSendInput,
): Promise<{
  userMessage: CommandCenterMessageRecord
  assistantMessage: CommandCenterMessageRecord
  context: CommandCenterContext
  thinkingPhases: string[]
  engine: "llm" | "heuristic" | "vision"
  decision?: TradeDecisionResult
  chartVision?: CommandCenterVisionAnalysis
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

export async function archiveCommandCenterSession(): Promise<{
  archived: boolean
  sessionId?: string
  skipped?: boolean
}> {
  const response = await fetch("/api/command-center/sessions/archive", {
    method: "POST",
    credentials: "include",
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Failed to archive session")
  }
  return payload
}

export async function fetchCommandCenterSessions(): Promise<CompanionSessionSummary[]> {
  const response = await fetch("/api/command-center/sessions", {
    method: "GET",
    credentials: "include",
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Failed to load session history")
  }
  return (payload.sessions ?? []) as CompanionSessionSummary[]
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
