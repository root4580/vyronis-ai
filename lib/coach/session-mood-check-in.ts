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
