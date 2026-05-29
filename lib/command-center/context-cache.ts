import type { CommandCenterContext, CommandCenterMode } from "@/lib/command-center/types"

const CACHE_KEY = "vyronis.command-center.context"
const CACHE_TTL_MS = 5 * 60 * 1000

type CacheEnvelope = {
  userId: string
  mode: CommandCenterMode
  focusId: string | null
  sessionId: string | null
  context: CommandCenterContext
  updatedAt: number
}

function cacheKey(
  userId: string,
  mode: CommandCenterMode,
  focusId: string | null,
  sessionId: string | null,
): string {
  return `${userId}:${mode}:${focusId ?? ""}:${sessionId ?? ""}`
}

export function readCommandCenterContextCache(
  userId: string,
  mode: CommandCenterMode,
  focusId: string | null,
  sessionId: string | null,
): CommandCenterContext | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const envelope = JSON.parse(raw) as CacheEnvelope
    if (envelope.userId !== userId) return null
    if (Date.now() - envelope.updatedAt > CACHE_TTL_MS) return null
    if (cacheKey(userId, mode, focusId, sessionId) !== cacheKey(
      envelope.userId,
      envelope.mode,
      envelope.focusId,
      envelope.sessionId,
    )) {
      return null
    }
    return envelope.context
  } catch {
    return null
  }
}

export function writeCommandCenterContextCache(
  userId: string,
  mode: CommandCenterMode,
  focusId: string | null,
  sessionId: string | null,
  context: CommandCenterContext,
): void {
  if (typeof window === "undefined") return
  try {
    const envelope: CacheEnvelope = {
      userId,
      mode,
      focusId,
      sessionId,
      context,
      updatedAt: Date.now(),
    }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(envelope))
  } catch {
    // Quota or private mode — ignore
  }
}

export function clearCommandCenterContextCache(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(CACHE_KEY)
}
