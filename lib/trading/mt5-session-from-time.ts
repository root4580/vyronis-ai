import {
  detectTradingSessionFromEstClock,
  mapSessionLabelToFormValue,
  utcInstantToEstClock,
} from "@/lib/trading/session-timing"

/** MT5 screenshots usually show broker server time (often EET/EEST). Hours offset from UTC. */
export function getMt5BrokerUtcOffsetHours(): number {
  const raw = process.env.MT5_SCREENSHOT_UTC_OFFSET?.trim()
  if (raw) {
    const parsed = Number(raw)
    if (Number.isFinite(parsed) && parsed >= -12 && parsed <= 14) return parsed
  }
  return 3
}

export type Mt5ParsedTimestamp = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** Parses MT5 mobile/desktop timestamps like `2026.05.29 18:49:49`. */
export function parseMt5Timestamp(raw: string | null | undefined): Mt5ParsedTimestamp | null {
  if (!raw?.trim()) return null
  const match = raw
    .trim()
    .match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6] ?? 0)

  if (
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null
  }

  return { year, month, day, hour, minute, second }
}

/** Wall clock on MT5 screenshot → UTC instant (broker offset from UTC). */
export function mt5WallClockToUtc(
  parts: Mt5ParsedTimestamp,
  brokerUtcOffsetHours = getMt5BrokerUtcOffsetHours(),
): Date {
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour - brokerUtcOffsetHours,
      parts.minute,
      parts.second,
    ),
  )
}

export function formatEstTimeLabel(utcInstant: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(utcInstant)
}

export function inferSessionFromMt5Timestamps(input: {
  openTimeRaw?: string | null
  closeTimeRaw?: string | null
  tradeDate?: string | null
}): {
  session: string | null
  sessionEstLabel: string | null
  tradeDate: string | null
  openEstLabel: string | null
} {
  const brokerOffset = getMt5BrokerUtcOffsetHours()
  const timeRaw = input.openTimeRaw?.trim() || input.closeTimeRaw?.trim() || null
  const parts = parseMt5Timestamp(timeRaw)
  if (!parts) {
    return {
      session: null,
      sessionEstLabel: null,
      tradeDate: input.tradeDate ?? null,
      openEstLabel: null,
    }
  }

  const utc = mt5WallClockToUtc(parts, brokerOffset)
  const estClock = utcInstantToEstClock(utc)
  const sessionInfo = detectTradingSessionFromEstClock(estClock)
  const session = mapSessionLabelToFormValue(sessionInfo.name)
  const openEstLabel = formatEstTimeLabel(utc)

  const tradeDate =
    input.tradeDate ??
    `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`

  const sessionEstLabel = `${openEstLabel} → ${session ?? sessionInfo.name}`

  return {
    session,
    sessionEstLabel,
    tradeDate,
    openEstLabel,
  }
}
