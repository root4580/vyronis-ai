import { DEFAULT_USER_PROFILE } from "@/lib/user-profile"

/** Forex trading week — Sunday 5:00 PM through Friday 4:59 PM (America/New_York). */
export const TRADING_WEEK_TIMEZONE =
  DEFAULT_USER_PROFILE.timezone || "America/New_York"

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export type EtDateTimeParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  dayOfWeek: number
}

export type TradingWeekBounds = {
  start: Date
  end: Date
  weekStartKey: string
  label: string
}

const OPEN_MINUTES = 17 * 60
const CLOSE_MINUTES = 16 * 60 + 59

export function getEtParts(instant: Date, timeZone = TRADING_WEEK_TIMEZONE): EtDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(instant)

  const map = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  )

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    dayOfWeek: WEEKDAY_TO_INDEX[map.weekday] ?? 0,
  }
}

function compareEtWallClock(
  actual: EtDateTimeParts,
  target: Pick<EtDateTimeParts, "year" | "month" | "day" | "hour" | "minute" | "second">,
): number {
  const fields: Array<keyof typeof target> = [
    "year",
    "month",
    "day",
    "hour",
    "minute",
    "second",
  ]
  for (const field of fields) {
    if (actual[field] < target[field]) return -1
    if (actual[field] > target[field]) return 1
  }
  return 0
}

/** Convert an America/New_York wall-clock time to a UTC instant. */
export function instantFromEtWallClock(input: {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second?: number
}): Date {
  const target = {
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute,
    second: input.second ?? 0,
  }

  let low = Date.UTC(input.year, input.month - 1, input.day - 1, 0, 0, 0)
  let high = Date.UTC(input.year, input.month - 1, input.day + 1, 23, 59, 59)

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const cmp = compareEtWallClock(getEtParts(new Date(mid)), target)
    if (cmp === 0) return new Date(mid)
    if (cmp < 0) low = mid + 1
    else high = mid - 1
  }

  return new Date(
    Date.UTC(input.year, input.month - 1, input.day, input.hour + 5, input.minute, target.second),
  )
}

export function etDateKey(parts: Pick<EtDateTimeParts, "year" | "month" | "day">): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`
}

export function addEtCalendarDays(
  parts: Pick<EtDateTimeParts, "year" | "month" | "day">,
  deltaDays: number,
): Pick<EtDateTimeParts, "year" | "month" | "day"> {
  const anchor = instantFromEtWallClock({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 12,
    minute: 0,
  })
  const shifted = new Date(anchor.getTime() + deltaDays * 86_400_000)
  const next = getEtParts(shifted)
  return { year: next.year, month: next.month, day: next.day }
}

function formatEtDateLabel(parts: Pick<EtDateTimeParts, "year" | "month" | "day">): string {
  const instant = instantFromEtWallClock({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 12,
    minute: 0,
  })
  return instant.toLocaleDateString("en-US", {
    timeZone: TRADING_WEEK_TIMEZONE,
    month: "short",
    day: "numeric",
  })
}

function formatTradingWeekLabel(
  start: Pick<EtDateTimeParts, "year" | "month" | "day">,
  end: Pick<EtDateTimeParts, "year" | "month" | "day">,
): string {
  const startLabel = formatEtDateLabel(start)
  const endLabel = formatEtDateLabel(end)
  return `${startLabel} 5:00 PM – ${endLabel} 4:59 PM ET`
}

function resolveTradingWeekStartParts(reference: EtDateTimeParts): EtDateTimeParts {
  const totalMinutes = reference.hour * 60 + reference.minute

  let daysBackToSunday = reference.dayOfWeek

  if (reference.dayOfWeek === 0 && totalMinutes < OPEN_MINUTES) {
    return {
      year: reference.year,
      month: reference.month,
      day: reference.day,
      hour: 17,
      minute: 0,
      second: 0,
      dayOfWeek: 0,
    }
  }

  if (reference.dayOfWeek === 6) {
    daysBackToSunday = 6
  } else if (reference.dayOfWeek === 5 && totalMinutes > CLOSE_MINUTES) {
    daysBackToSunday = 5
  } else if (reference.dayOfWeek === 0) {
    daysBackToSunday = 0
  }

  const sunday = addEtCalendarDays(reference, -daysBackToSunday)
  return {
    year: sunday.year,
    month: sunday.month,
    day: sunday.day,
    hour: 17,
    minute: 0,
    second: 0,
    dayOfWeek: 0,
  }
}

function resolveTradingWeekEndParts(start: EtDateTimeParts): EtDateTimeParts {
  const friday = addEtCalendarDays(start, 5)
  return {
    year: friday.year,
    month: friday.month,
    day: friday.day,
    hour: 16,
    minute: 59,
    second: 59,
    dayOfWeek: 5,
  }
}

export function getTradingWeekBounds(
  referenceDate = new Date(),
  weekOffset = 0,
): TradingWeekBounds {
  const startParts = resolveTradingWeekStartParts(getEtParts(referenceDate))

  if (weekOffset !== 0) {
    const shiftedSunday = addEtCalendarDays(startParts, weekOffset * 7)
    startParts.year = shiftedSunday.year
    startParts.month = shiftedSunday.month
    startParts.day = shiftedSunday.day
  }

  const endParts = resolveTradingWeekEndParts(startParts)
  const start = instantFromEtWallClock(startParts)
  const end = instantFromEtWallClock(endParts)
  end.setMilliseconds(999)

  return {
    start,
    end,
    weekStartKey: etDateKey(startParts),
    label: formatTradingWeekLabel(startParts, endParts),
  }
}

export function getTradingWeekBoundsFromStartKey(weekStartKey: string): TradingWeekBounds {
  const [year, month, day] = weekStartKey.split("-").map(Number)
  return getTradingWeekBounds(
    instantFromEtWallClock({ year, month, day, hour: 17, minute: 0 }),
    0,
  )
}

export function getTradingWeekStartKey(referenceDate = new Date(), weekOffset = 0): string {
  return getTradingWeekBounds(referenceDate, weekOffset).weekStartKey
}

export function isForexTradingWeekOpen(referenceDate = new Date()): boolean {
  const instant = referenceDate.getTime()
  const { start, end } = getTradingWeekBounds(referenceDate, 0)
  return instant >= start.getTime() && instant <= end.getTime()
}

export function isTradeInTradingWeek(
  trade: { trade_date?: string | null; created_at?: string | null },
  start: Date,
  end: Date,
): boolean {
  const raw = trade.trade_date || trade.created_at
  if (!raw) return false
  const ts = new Date(raw).getTime()
  if (Number.isNaN(ts)) return false
  return ts >= start.getTime() && ts <= end.getTime()
}
