import type {
  CommandCenterContext,
  CommandCenterMessageRecord,
  CommandCenterMode,
} from "@/lib/command-center/types"

export async function fetchCommandCenterContext(
  mode: CommandCenterMode = "companion",
): Promise<CommandCenterContext> {
  const response = await fetch(`/api/command-center/context?mode=${mode}`, {
    method: "GET",
    credentials: "include",
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Failed to load command center context")
  }

  return payload as CommandCenterContext
}

export async function sendCommandCenterMessage(content: string): Promise<{
  userMessage: CommandCenterMessageRecord
  assistantMessage: CommandCenterMessageRecord
  context: CommandCenterContext
}> {
  const response = await fetch("/api/command-center/messages", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Failed to send message")
  }

  return payload
}
