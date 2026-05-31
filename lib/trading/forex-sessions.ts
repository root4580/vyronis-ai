/** Forex Factory–style session windows in the viewer's local timezone. */

import { formatTimeUntilSessionOpen } from "@/lib/trading/session-timing"

export type ForexSessionDefinition = {
  id: string
  label: string
  timeZone: string
  /** Open minute of day in the viewer's local time (0–1439). */
  localOpenMinutes: number
  /** Close minute of day in the viewer's local time. If less than open, wraps past midnight. */
  localCloseMinutes: number
  accent: string
}

export const FOREX_SESSIONS: ForexSessionDefinition[] = [
  {
    id: "sydney",
    label: "Sydney",
    timeZone: "Australia/Sydney",
    localOpenMinutes: 17 * 60,
    localCloseMinutes: 2 * 60,
    accent: "#38bdf8",
  },
  {
    id: "tokyo",
    label: "Tokyo",
    timeZone: "Asia/Tokyo",
    localOpenMinutes: 20 * 60,
    localCloseMinutes: 4 * 60,
    accent: "#c084fc",
  },
  {
    id: "london",
    label: "London",
    timeZone: "Europe/London",
    localOpenMinutes: 3 * 60,
    localCloseMinutes: 12 * 60,
    accent: "#f59e0b",
  },
  {
    id: "newyork",
    label: "New York",
    timeZone: "America/New_York",
    localOpenMinutes: 8 * 60,
    localCloseMinutes: 17 * 60,
    accent: "#22d3ee",
  },
]

export type SessionBarSegment = {
  leftPercent: number
  widthPercent: number
}

export type ForexSessionSnapshot = ForexSessionDefinition & {
  localTimeLabel: string
  isOpen: boolean
  barSegments: SessionBarSegment[]
  msUntilOpen: number | null
  opensAtLocalLabel: string | null
  countdownLabel: string | null
}

export type ForexSessionHeaderState = {
  primaryLabel: string
  secondaryLabel: string
  accent: string
  msUntilOpen: number | null
  isLive: boolean
}

export type LocalClock = {
  totalMinutes: number
  /** 0 = Sunday … 6 = Saturday (viewer local calendar). */
  dayOfWeek: number
}

/** Hour labels on the FF-style axis (viewer local wall clock). */
export const FOREX_TIMELINE_LABELS: Array<{ localMinutes: number; label: string }> = [
  { localMinutes: 18 * 60, label: "6pm" },
  { localMinutes: 20 * 60, label: "8pm" },
  { localMinutes: 22 * 60, label: "10pm" },
  { localMinutes: 0, label: "12am" },
  { localMinutes: 2 * 60, label: "2am" },
  { localMinutes: 4 * 60, label: "4am" },
  { localMinutes: 6 * 60, label: "6am" },
  { localMinutes: 8 * 60, label: "8am" },
  { localMinutes: 10 * 60, label: "10am" },
  { localMinutes: 12 * 60, label: "12pm" },
  { localMinutes: 14 * 60, label: "2pm" },
  { localMinutes: 16 * 60, label: "4pm" },
]

const TIMELINE_START_MINUTES = 18 * 60
const TIMELINE_SPAN_MINUTES = 22 * 60
const TIMELINE_END_MINUTES = 16 * 60

export function getLocalClock(now = new Date()): LocalClock {
  return {
    totalMinutes: now.getHours() * 60 + now.getMinutes(),
    dayOfWeek: now.getDay(),
  }
}

function normalizeLocalMinute(minute: number): number {
  const wrapped = minute % 1440
  return wrapped < 0 ? wrapped + 1440 : wrapped
}

/** Forex week: closed Fri 5pm → Sun 5pm (viewer local), then Sydney opens. */
function isForexMarketClosed(local: LocalClock): boolean {
  const { dayOfWeek, totalMinutes } = local
  const nyClose = 17 * 60
  const sydneyOpen = 17 * 60

  if (dayOfWeek === 6) return true
  if (dayOfWeek === 0 && totalMinutes < sydneyOpen) return true
  if (dayOfWeek === 5 && totalMinutes >= nyClose) return true
  return false
}

function getMostRecentActiveSession(
  active: ForexSessionDefinition[],
  local: LocalClock,
): ForexSessionDefinition {
  const activeIds = new Set(active.map((session) => session.id))
  for (let index = FOREX_SESSIONS.length - 1; index >= 0; index -= 1) {
    const session = FOREX_SESSIONS[index]
    if (!activeIds.has(session.id)) continue

    if (isSessionWindowOpen(session.localOpenMinutes, session.localCloseMinutes, local.totalMinutes)) {
      return session
    }
  }
  return active[active.length - 1]
}

function getNextSessionAfterActive(
  active: ForexSessionDefinition[],
  now = new Date(),
): {
  session: ForexSessionDefinition
  msUntilOpen: number
  opensAtLocalLabel: string
} | null {
  const activeIds = new Set(active.map((session) => session.id))
  let best: {
    session: ForexSessionDefinition
    msUntilOpen: number
    opensAtLocalLabel: string
  } | null = null

  for (const session of FOREX_SESSIONS) {
    if (activeIds.has(session.id)) continue
    const msUntilOpen = getMsUntilForexSessionOpens(session, now)
    if (msUntilOpen == null || msUntilOpen <= 0) continue

    const openInstant = new Date(now.getTime() + msUntilOpen)
    const candidate = {
      session,
      msUntilOpen,
      opensAtLocalLabel: formatOpensAtLocalTime(openInstant),
    }

    if (!best || msUntilOpen < best.msUntilOpen) {
      best = candidate
    }
  }

  return best
}

function localWallClockToInstant(baseDate: Date, dayOffset: number, totalMinutes: number): Date {
  const dayStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
  const target = new Date(dayStart)
  target.setDate(target.getDate() + dayOffset)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  target.setHours(hours, minutes, 0, 0)
  return target
}

function formatOpensAtLocalTime(openInstant: Date): string {
  return openInstant
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase()
}

function isSessionWindowOpen(
  openMinutes: number,
  closeMinutes: number,
  localTotalMinutes: number,
): boolean {
  const open = normalizeLocalMinute(openMinutes)
  const close = normalizeLocalMinute(closeMinutes)
  const now = normalizeLocalMinute(localTotalMinutes)

  if (open < close) {
    return now >= open && now < close
  }
  return now >= open || now < close
}

/** FF-style session open check — respects forex weekend (Fri 5pm → Sun 5pm closed). */
export function isForexSessionOpen(
  openMinutes: number,
  closeMinutes: number,
  local: LocalClock,
): boolean {
  if (isForexMarketClosed(local)) {
    return false
  }
  return isSessionWindowOpen(openMinutes, closeMinutes, local.totalMinutes)
}

export function getMsUntilForexSessionOpens(
  session: ForexSessionDefinition,
  now = new Date(),
): number | null {
  const local = getLocalClock(now)
  if (isForexSessionOpen(session.localOpenMinutes, session.localCloseMinutes, local)) {
    return null
  }

  for (let dayOffset = 0; dayOffset < 4; dayOffset++) {
    const openInstant = localWallClockToInstant(now, dayOffset, session.localOpenMinutes)
    if (openInstant.getTime() > now.getTime()) {
      return openInstant.getTime() - now.getTime()
    }
  }

  return null
}

export function getNextForexSessionToOpen(now = new Date()): {
  session: ForexSessionDefinition
  msUntilOpen: number
  opensAtLocalLabel: string
} | null {
  let best: {
    session: ForexSessionDefinition
    msUntilOpen: number
    opensAtLocalLabel: string
  } | null = null

  for (const session of FOREX_SESSIONS) {
    const msUntilOpen = getMsUntilForexSessionOpens(session, now)
    if (msUntilOpen == null || msUntilOpen <= 0) continue

    const openInstant = new Date(now.getTime() + msUntilOpen)
    const candidate = {
      session,
      msUntilOpen,
      opensAtLocalLabel: formatOpensAtLocalTime(openInstant),
    }

    if (!best || msUntilOpen < best.msUntilOpen) {
      best = candidate
    }
  }

  return best
}

export function getActiveForexSessions(now = new Date()): ForexSessionDefinition[] {
  const local = getLocalClock(now)
  return FOREX_SESSIONS.filter((session) =>
    isForexSessionOpen(session.localOpenMinutes, session.localCloseMinutes, local),
  )
}

export function getForexSessionHeaderState(now = new Date()): ForexSessionHeaderState {
  const local = getLocalClock(now)
  const active = getActiveForexSessions(now)

  if (active.length > 0) {
    const primary = getMostRecentActiveSession(active, local)
    const upcoming = getNextSessionAfterActive(active, now)
    const label =
      active.length === 1
        ? active[0].label
        : active.map((session) => session.label).join(" · ")

    return {
      primaryLabel: label,
      secondaryLabel: upcoming
        ? `${upcoming.session.label} opens in ${formatTimeUntilSessionOpen(upcoming.msUntilOpen)} (${upcoming.opensAtLocalLabel} your time)`
        : "session open",
      accent: primary.accent,
      msUntilOpen: upcoming?.msUntilOpen ?? null,
      isLive: true,
    }
  }

  const next = getNextForexSessionToOpen(now)
  if (!next) {
    return {
      primaryLabel: "Markets",
      secondaryLabel: "closed",
      accent: "#94a3b8",
      msUntilOpen: null,
      isLive: false,
    }
  }

  return {
    primaryLabel: next.session.label,
    secondaryLabel: `opens in ${formatTimeUntilSessionOpen(next.msUntilOpen)} (${next.opensAtLocalLabel} your time)`,
    accent: next.session.accent,
    msUntilOpen: next.msUntilOpen,
    isLive: false,
  }
}

/** Map a local wall-clock minute onto the FF-style 6pm → 4pm axis. */
export function localMinuteToTimelinePercent(localMinute: number): number {
  const minute = normalizeLocalMinute(localMinute)

  if (minute >= TIMELINE_START_MINUTES) {
    return ((minute - TIMELINE_START_MINUTES) / TIMELINE_SPAN_MINUTES) * 100
  }

  if (minute <= TIMELINE_END_MINUTES) {
    return ((1440 - TIMELINE_START_MINUTES + minute) / TIMELINE_SPAN_MINUTES) * 100
  }

  return -1
}

export function formatForexLocalTime(timeZone: string, now = new Date()): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now)

  return `${formatted.toLowerCase()} local`
}

function timelineMinuteWindow(): Array<{ start: number; end: number }> {
  return [
    { start: TIMELINE_START_MINUTES, end: 1440 },
    { start: 0, end: TIMELINE_END_MINUTES },
  ]
}

function intersectMinuteRanges(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): { start: number; end: number } | null {
  const start = Math.max(aStart, bStart)
  const end = Math.min(aEnd, bEnd)
  return end > start ? { start, end } : null
}

export function buildSessionBarSegments(
  openMinutes: number,
  closeMinutes: number,
): SessionBarSegment[] {
  const open = normalizeLocalMinute(openMinutes)
  const close = normalizeLocalMinute(closeMinutes)

  const sessionRanges =
    open < close
      ? [{ start: open, end: close }]
      : [
          { start: open, end: 1440 },
          { start: 0, end: close },
        ]

  const segments: SessionBarSegment[] = []

  for (const window of timelineMinuteWindow()) {
    for (const range of sessionRanges) {
      const hit = intersectMinuteRanges(range.start, range.end, window.start, window.end)
      if (!hit) continue

      const left = localMinuteToTimelinePercent(hit.start)
      const right = localMinuteToTimelinePercent(hit.end)
      if (left < 0 || right < 0 || right <= left) continue

      segments.push({
        leftPercent: left,
        widthPercent: right - left,
      })
    }
  }

  return segments
}

export function getForexSessionSnapshots(now = new Date()): ForexSessionSnapshot[] {
  const local = getLocalClock(now)

  return FOREX_SESSIONS.map((session) => {
    const isOpen = isForexSessionOpen(
      session.localOpenMinutes,
      session.localCloseMinutes,
      local,
    )
    const msUntilOpen = isOpen ? null : getMsUntilForexSessionOpens(session, now)
    const openInstant =
      msUntilOpen != null && msUntilOpen > 0 ? new Date(now.getTime() + msUntilOpen) : null

    return {
      ...session,
      localTimeLabel: formatForexLocalTime(session.timeZone, now),
      isOpen,
      barSegments: buildSessionBarSegments(session.localOpenMinutes, session.localCloseMinutes),
      msUntilOpen,
      opensAtLocalLabel: openInstant ? formatOpensAtLocalTime(openInstant) : null,
      countdownLabel:
        msUntilOpen != null && msUntilOpen > 0
          ? `Begins in ${formatTimeUntilSessionOpen(msUntilOpen)}${
              openInstant ? ` (${formatOpensAtLocalTime(openInstant)} your time)` : ""
            }`
          : isOpen
            ? "Open now"
            : null,
    }
  })
}

export function getForexTimelineNowPercent(localTotalMinutes: number): number {
  return localMinuteToTimelinePercent(localTotalMinutes)
}
