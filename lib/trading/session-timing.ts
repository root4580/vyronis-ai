export type TradingSessionInfo = {
  name: string
  isActive: boolean
}

export type SessionClockInfo = TradingSessionInfo & {
  nextSessionName: string | null
  hoursUntilNextSession: number | null
  msUntilNextSession: number | null
  /** e.g. "Asia Session · opens in 12h 30m 45s" */
  nextSessionLabel: string | null
}

export type SessionVisualTheme = {
  accent: string
  background: string
  border: string
  muted: string
}

function themeFromAccent(accent: string): SessionVisualTheme {
  return {
    accent,
    background: `rgb(from ${accent} r g b / 0.08)`,
    border: `rgb(from ${accent} r g b / 0.28)`,
    muted: `rgb(from ${accent} r g b / 0.62)`,
  }
}

/** Visual theme per session label (matches dashboard nav session colors). */
export function getSessionVisualTheme(sessionName: string): SessionVisualTheme {
  const name = sessionName.toLowerCase()

  if (name.includes("weekend")) {
    return themeFromAccent("#94a3b8")
  }
  if (name.includes("closed") || name.includes("off hour")) {
    return themeFromAccent("var(--text-muted)")
  }
  if (name.includes("overlap")) {
    return themeFromAccent("var(--color-profit)")
  }
  if (name.includes("new york") || (name.includes("ny") && name.includes("session"))) {
    return themeFromAccent("var(--color-accent)")
  }
  if (name.includes("london")) {
    return themeFromAccent("var(--color-warning)")
  }
  if (name.includes("asia")) {
    return themeFromAccent("#a855f7")
  }

  return themeFromAccent("var(--text-muted)")
}

/** Card shell: active session, or weekend/market-closed status when idle. */
export function getSessionClockTheme(clock: SessionClockInfo): SessionVisualTheme {
  if (clock.isActive) {
    return getSessionVisualTheme(clock.name)
  }
  return getSessionVisualTheme(clock.name)
}

/** Accent for subtitle + countdown (next session when waiting). */
export function getSessionClockAccentTheme(clock: SessionClockInfo): SessionVisualTheme {
  if (clock.isActive) {
    return getSessionVisualTheme(clock.name)
  }
  if (clock.nextSessionName) {
    return getSessionVisualTheme(clock.nextSessionName)
  }
  return getSessionVisualTheme(clock.name)
}

/** Fixed EST offset used across dashboard session logic (matches existing header). */
const EST_UTC_OFFSET_HOURS = -5

const SESSION_PROBE_MS = 60_000
const SESSION_PROBE_MAX_MS = 8 * 24 * 60 * 60 * 1000

export type EstClock = {
  hours: number
  minutes: number
  totalMinutes: number
  /** 0 = Sunday … 6 = Saturday (EST wall calendar). */
  dayOfWeek: number
}

export function utcInstantToEstClock(utcInstant: Date): EstClock {
  const utcMs = utcInstant.getTime() + utcInstant.getTimezoneOffset() * 60000
  const est = new Date(utcMs + 3600000 * EST_UTC_OFFSET_HOURS)
  const hours = est.getHours()
  const minutes = est.getMinutes()
  return { hours, minutes, totalMinutes: hours * 60 + minutes, dayOfWeek: est.getDay() }
}

/** EST-based session detection from an EST wall clock (hours/minutes in New York). */
export function detectTradingSessionFromEstClock(est: EstClock): TradingSessionInfo {
  if (est.dayOfWeek === 0 || est.dayOfWeek === 6) {
    return { name: "Weekend", isActive: false }
  }

  const totalMinutes = est.totalMinutes

  const asiaStart = 19 * 60
  const asiaEnd = 4 * 60
  const londonStart = 3 * 60
  const londonEnd = 12 * 60
  const nyStart = 8 * 60
  const nyEnd = 17 * 60
  const overlapStart = 8 * 60
  const overlapEnd = 12 * 60

  if (totalMinutes >= overlapStart && totalMinutes < overlapEnd) {
    return { name: "London + NY Overlap", isActive: true }
  }
  if (totalMinutes >= nyStart && totalMinutes < nyEnd) {
    return { name: "New York Session", isActive: true }
  }
  if (totalMinutes >= londonStart && totalMinutes < londonEnd) {
    return { name: "London Session", isActive: true }
  }
  if (totalMinutes >= asiaStart || totalMinutes < asiaEnd) {
    return { name: "Asia Session", isActive: true }
  }
  return { name: "Market Closed", isActive: false }
}

export function formatTimeUntilSessionOpen(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

export function formatHoursUntilSessionOpen(hours: number): string {
  return formatTimeUntilSessionOpen(hours * 60 * 60 * 1000)
}

function refineSessionOpenTime(approxOpen: Date): Date {
  const endMs = approxOpen.getTime()
  const startMs = endMs - 60_000

  for (let t = startMs; t <= endMs; t += 1000) {
    const prev = detectTradingSession(new Date(t))
    const next = detectTradingSession(new Date(t + 1000))
    if (!prev.isActive && next.isActive) {
      return new Date(t + 1000)
    }
  }

  return approxOpen
}

/** Next time a session becomes active (walks forward in EST calendar). */
export function findNextSessionOpen(now = new Date()): {
  name: string
  opensAt: Date
  msRemaining: number
} | null {
  const startMs = now.getTime()

  for (let offsetMs = SESSION_PROBE_MS; offsetMs <= SESSION_PROBE_MAX_MS; offsetMs += SESSION_PROBE_MS) {
    const probe = new Date(startMs + offsetMs)
    const session = detectTradingSession(probe)
    if (!session.isActive) continue

    const opensAt = refineSessionOpenTime(probe)
    const msRemaining = Math.max(0, opensAt.getTime() - startMs)
    return { name: session.name, opensAt, msRemaining }
  }

  return null
}

export function getSessionClock(now = new Date()): SessionClockInfo {
  const current = detectTradingSession(now)

  if (current.isActive) {
    return {
      ...current,
      nextSessionName: null,
      hoursUntilNextSession: null,
      msUntilNextSession: null,
      nextSessionLabel: null,
    }
  }

  const next = findNextSessionOpen(now)
  if (!next) {
    return {
      ...current,
      nextSessionName: null,
      hoursUntilNextSession: null,
      msUntilNextSession: null,
      nextSessionLabel: null,
    }
  }

  const eta = formatTimeUntilSessionOpen(next.msRemaining)
  return {
    ...current,
    nextSessionName: next.name,
    hoursUntilNextSession: next.msRemaining / (1000 * 60 * 60),
    msUntilNextSession: next.msRemaining,
    nextSessionLabel: `${next.name} · opens in ${eta}`,
  }
}

/** Maps long session labels to Add Trade form values. */
export function mapSessionLabelToFormValue(sessionName: string): string | null {
  const name = sessionName.toLowerCase()
  if (name.includes("overlap")) return "London + New York Overlap"
  if (name.includes("new york") || name.includes("ny")) return "New York"
  if (name.includes("london")) return "London"
  if (name.includes("asia")) return "Asia"
  return null
}

/** EST-based session detection (matches dashboard header logic). */
export function detectTradingSession(now = new Date()): TradingSessionInfo {
  return detectTradingSessionFromEstClock(utcInstantToEstClock(now))
}

export function sessionFitsPreference(sessionName: string, preferred?: string | null): boolean {
  if (!preferred?.trim()) return true
  const pref = preferred.toLowerCase()
  const name = sessionName.toLowerCase()
  if (pref.includes("ny") || pref.includes("new york")) return name.includes("new york") || name.includes("overlap")
  if (pref.includes("london")) return name.includes("london")
  if (pref.includes("asia")) return name.includes("asia")
  return true
}
