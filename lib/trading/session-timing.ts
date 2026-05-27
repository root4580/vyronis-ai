export type TradingSessionInfo = {
  name: string
  isActive: boolean
}

/** EST-based session detection (matches dashboard header logic). */
export function detectTradingSession(now = new Date()): TradingSessionInfo {
  const estOffset = -5
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  const est = new Date(utc + 3600000 * estOffset)
  const totalMinutes = est.getHours() * 60 + est.getMinutes()

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

export function sessionFitsPreference(sessionName: string, preferred?: string | null): boolean {
  if (!preferred?.trim()) return true
  const pref = preferred.toLowerCase()
  const name = sessionName.toLowerCase()
  if (pref.includes("ny") || pref.includes("new york")) return name.includes("new york") || name.includes("overlap")
  if (pref.includes("london")) return name.includes("london")
  if (pref.includes("asia")) return name.includes("asia")
  return true
}
