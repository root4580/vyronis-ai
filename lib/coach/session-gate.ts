import { getSessionClock, utcInstantToEstClock } from "@/lib/trading/session-timing"

export const ALLOWED_ENTRY_SESSION_NAMES = [
  "London Session",
  "New York Session",
  "London + NY Overlap",
] as const

export type SessionGateDebug = {
  currentTimeUtc: string
  currentTimeEst: string
  currentTimeLabel: string
  timezone: string
  detectedSession: string
  detectedSessionActive: boolean
  loggedSession: string | null
  allowedSessions: string
  sessionValid: boolean
  failureReason: string | null
  alignedWithLoggedSession: boolean | null
}

function resolveTimezone(): string {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  }
  return "UTC"
}

export function formatEstWallTime(now: Date): string {
  const est = utcInstantToEstClock(now)
  const hours = String(est.hours).padStart(2, "0")
  const minutes = String(est.minutes).padStart(2, "0")
  return `${hours}:${minutes} EST`
}

export function isAllowedEntrySession(sessionName: string): boolean {
  const lower = sessionName.toLowerCase()
  if (lower.includes("overlap")) return true
  if (lower.includes("new york") || lower === "ny session") return true
  if (lower.includes("london") && !lower.includes("asia")) return true
  return false
}

function loggedSessionAlignsWithDetected(
  loggedSession: string | null,
  detectedSession: string,
): boolean | null {
  if (!loggedSession?.trim()) return null
  const logged = loggedSession.trim().toLowerCase()
  const detected = detectedSession.toLowerCase()

  if (logged.includes("london") && detected.includes("london")) return true
  if (
    (logged.includes("new york") || logged === "ny" || logged.includes("newyork")) &&
    (detected.includes("new york") || detected.includes("overlap"))
  ) {
    return true
  }
  if (logged.includes("overlap") && detected.includes("overlap")) return true
  if (logged.includes("asia") || logged.includes("sydney") || logged.includes("asian")) {
    return false
  }
  return logged.includes("london") || logged.includes("new york")
    ? detected.includes("london") || detected.includes("new york") || detected.includes("overlap")
    : null
}

export function evaluateSessionGate(input: {
  loggedSession?: string | null
  now?: Date
}): {
  passed: boolean
  note: string
  debug: SessionGateDebug
} {
  const now = input.now ?? new Date()
  const clock = getSessionClock(now)
  const estTime = formatEstWallTime(now)
  const loggedSession = input.loggedSession?.trim() || null
  const allowedSessions = ALLOWED_ENTRY_SESSION_NAMES.join(", ")
  const allowedActive = clock.isActive && isAllowedEntrySession(clock.name)
  const alignment = loggedSessionAlignsWithDetected(loggedSession, clock.name)

  let failureReason: string | null = null
  if (!clock.isActive) {
    failureReason = `Outside trading hours — detected ${clock.name}.`
  } else if (!isAllowedEntrySession(clock.name)) {
    failureReason = `${clock.name} is active but playbook allows London/NY only.`
  } else if (alignment === false) {
    failureReason = `Logged session "${loggedSession}" does not match live ${clock.name}.`
  }

  const passed = allowedActive && alignment !== false

  const currentTimeLabel = `${estTime} · ${clock.name}`

  const debug: SessionGateDebug = {
    currentTimeUtc: now.toISOString(),
    currentTimeEst: estTime,
    currentTimeLabel,
    timezone: resolveTimezone(),
    detectedSession: clock.name,
    detectedSessionActive: clock.isActive,
    loggedSession,
    allowedSessions,
    sessionValid: passed,
    failureReason: passed ? null : failureReason,
    alignedWithLoggedSession: alignment,
  }

  const note = passed
    ? `Live session ${clock.name} (${estTime}) — inside London/NY window.${
        loggedSession ? ` Logged: ${loggedSession}.` : ""
      }`
    : failureReason ??
      `Outside trading session — ${currentTimeLabel}. Allowed: ${allowedSessions}.`

  return { passed, note, debug }
}

export function logSessionGateDebug(debug: SessionGateDebug): void {
  if (typeof console !== "undefined") {
    console.info("[Vyronis Coach] Session gate evaluation", {
      currentTime: debug.currentTimeLabel,
      timezone: debug.timezone,
      detectedSession: debug.detectedSession,
      detectedSessionActive: debug.detectedSessionActive,
      loggedSession: debug.loggedSession,
      allowedSessions: debug.allowedSessions,
      sessionValid: debug.sessionValid,
      failureReason: debug.failureReason,
      alignedWithLoggedSession: debug.alignedWithLoggedSession,
    })
  }
}

/** Fixed UTC instant for a wall-clock time in EST (UTC-5, no DST). */
export function estWallInstant(dateIso: string, hoursEst: number, minutesEst = 0): Date {
  const utcHour = hoursEst + 5
  const carryDay = Math.floor(utcHour / 24)
  const hour = utcHour % 24
  const [year, month, day] = dateIso.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + carryDay, hour, minutesEst, 0))
}
