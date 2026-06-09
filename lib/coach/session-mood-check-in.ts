export const SESSION_MOOD_OPTIONS = [
  "Calm",
  "Confident",
  "Disciplined",
  "Anxious",
  "FOMO",
  "Revenge",
  "Euphoric",
  "Fearful",
] as const

const STORAGE_PREFIX = "vyronis.sessionMood"

export function getSessionMoodStorageKey(userId: string, referenceDate = new Date()): string {
  const day = referenceDate.toISOString().slice(0, 10)
  return `${STORAGE_PREFIX}.${userId}.${day}`
}

export function readSessionMood(userId: string | null | undefined): string | null {
  if (!userId || typeof sessionStorage === "undefined") return null
  return sessionStorage.getItem(getSessionMoodStorageKey(userId))?.trim() || null
}

export function writeSessionMood(userId: string, mood: string): void {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.setItem(getSessionMoodStorageKey(userId), mood.trim())
}

export function hasSessionMoodCheckIn(mood: string | null | undefined): boolean {
  return Boolean(mood?.trim())
}

export type SessionMoodOption = (typeof SESSION_MOOD_OPTIONS)[number]

/** Map chat text ("calm", "I'm feeling anxious") to a mood label when no check-in exists yet. */
export function parseSessionMoodFromMessage(text: string): SessionMoodOption | null {
  const raw = text.trim()
  if (!raw || raw.length > 80) return null

  const normalized = raw
    .toLowerCase()
    .replace(/[!.?]+$/g, "")
    .trim()

  for (const mood of SESSION_MOOD_OPTIONS) {
    if (normalized === mood.toLowerCase()) return mood
  }

  const moodPattern =
    /^(?:i\s*am|i'?m|im|feeling|feel|mood\s+is|today\s+i\s*am)\s+(calm|confident|disciplined|anxious|fomo|revenge|euphoric|fearful)$/i
  const match = normalized.match(moodPattern)
  if (match?.[1]) {
    const found = SESSION_MOOD_OPTIONS.find(
      (m) => m.toLowerCase() === match[1].toLowerCase(),
    )
    if (found) return found
  }

  return null
}

export function resolveEffectiveSessionMood(input: {
  explicitMood?: string | null
  message?: string | null
}): string | null {
  const explicit = input.explicitMood?.trim()
  if (explicit) return explicit
  return parseSessionMoodFromMessage(input.message ?? "") ?? null
}
