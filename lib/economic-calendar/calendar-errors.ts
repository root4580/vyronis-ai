export function formatCalendarError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Failed to load economic calendar."
  if (message.includes("429")) {
    return "Calendar feed is rate-limited. Cached data will show when available — try again shortly."
  }
  if (message.includes("<!DOCTYPE") || message.includes("<html")) {
    return "Calendar temporarily unavailable. Try again in a moment."
  }
  if (message.includes("ForexFactory calendar failed")) {
    return "Calendar temporarily unavailable. Try again in a moment."
  }
  return "Calendar unavailable right now. Try again in a moment."
}

export function sanitizeCalendarMessage(message: string | null | undefined): string {
  if (!message?.trim()) {
    return "Calendar unavailable right now. Try again in a moment."
  }
  if (message.includes("<!DOCTYPE") || message.includes("<html")) {
    return "Calendar temporarily unavailable. Try again in a moment."
  }
  return message
}
