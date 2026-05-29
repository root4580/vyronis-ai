export type TradingSessionInfo = {
  name: string
  isActive: boolean
}

/** Fixed EST offset used across dashboard session logic (matches existing header). */
const EST_UTC_OFFSET_HOURS = -5

export type EstClock = {
  hours: number
  minutes: number
  totalMinutes: number
}

export function utcInstantToEstClock(utcInstant: Date): EstClock {
  const utcMs = utcInstant.getTime() + utcInstant.getTimezoneOffset() * 60000
  const est = new Date(utcMs + 3600000 * EST_UTC_OFFSET_HOURS)
  const hours = est.getHours()
  const minutes = est.getMinutes()
  return { hours, minutes, totalMinutes: hours * 60 + minutes }
}

/** EST-based session detection from an EST wall clock (hours/minutes in New York). */
export function detectTradingSessionFromEstClock(est: EstClock): TradingSessionInfo {
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
