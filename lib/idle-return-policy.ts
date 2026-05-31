export const IDLE_REFRESH_MS = 10 * 60 * 1000
export const IDLE_SIGN_OUT_MS = 60 * 60 * 1000

const STORAGE_KEY = "vyronis-last-active-at"

export function readLastActiveAt(): number {
  if (typeof window === "undefined") return Date.now()
  const raw = sessionStorage.getItem(STORAGE_KEY)
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) ? parsed : Date.now()
}

export function touchLastActiveAt(at = Date.now()) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(STORAGE_KEY, String(at))
}

export function clearLastActiveAt() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(STORAGE_KEY)
}

export function getIdleAwayMs(now = Date.now(), lastActiveAt = readLastActiveAt()): number {
  return Math.max(0, now - lastActiveAt)
}
