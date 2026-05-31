export type TradingSessionInfo = {
  name: string
  isActive: boolean
}

export type SessionClockInfo = TradingSessionInfo & {
  nextSessionName: string | null
  hoursUntilNextSession: number | null
  /** e.g. "Asia Session · opens in 12h 30m" */
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

export function formatHoursUntilSessionOpen(hours: number): string {
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60))
    return `${minutes}m`
  }
  if (hours < 24) {
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    return minutes > 0 ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`
  }
  const days = Math.floor(hours / 24)
  const remainderHours = Math.round(hours % 24)
  return remainderHours > 0 ? `${days}d ${remainderHours}h` : `${days}d`
}

/** Next time a session becomes active (walks forward in EST calendar). */
export function findNextSessionOpen(now = new Date()): {
  name: string
  opensAt: Date
  hoursRemaining: number
} | null {
  const startMs = now.getTime()

  for (let offsetMs = SESSION_PROBE_MS; offsetMs <= SESSION_PROBE_MAX_MS; offsetMs += SESSION_PROBE_MS) {
    const probe = new Date(startMs + offsetMs)
    const session = detectTradingSession(probe)
    if (!session.isActive) continue

    const hoursRemaining = offsetMs / (1000 * 60 * 60)
    return { name: session.name, opensAt: probe, hoursRemaining }
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
      nextSessionLabel: null,
    }
  }

  const next = findNextSessionOpen(now)
  if (!next) {
    return {
      ...current,
      nextSessionName: null,
      hoursUntilNextSession: null,
      nextSessionLabel: null,
    }
  }

  const eta = formatHoursUntilSessionOpen(next.hoursRemaining)
  return {
    ...current,
    nextSessionName: next.name,
    hoursUntilNextSession: next.hoursRemaining,
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
