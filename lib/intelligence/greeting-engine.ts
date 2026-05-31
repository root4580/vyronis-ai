import { detectTradingSession } from "@/lib/trading/session-timing"
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile"
import type { CommandCenterGreeting, CommandCenterTraderSnapshot } from "@/lib/command-center/types"
import type { PrimaryLeakInsight } from "@/lib/behavior/types"
import type { PlannedCoachSessionItem } from "@/lib/trade-coach/types"

export const GREETING_VERSION = 2

export function getLocalHour(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  return hour === 24 ? 0 : hour
}

/** YYYY-MM-DD in the user's timezone — used for daily greeting cache keys. */
export function getLocalDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/** Time-of-day greeting in the user's timezone — midnight–4:59 is not "morning". */
export function getTimeOfDayGreeting(
  date = new Date(),
  timeZone = DEFAULT_USER_PROFILE.timezone,
): string {
  const hour = getLocalHour(date, timeZone)
  if (hour >= 5 && hour < 12) return "Good morning"
  if (hour >= 12 && hour < 17) return "Good afternoon"
  if (hour >= 17 && hour < 22) return "Good evening"
  return "Good night"
}

function timeGreeting(timeZone?: string): string {
  return getTimeOfDayGreeting(new Date(), timeZone)
}

export function buildContextualGreeting(input: {
  snapshot: CommandCenterTraderSnapshot
  primaryLeak: PrimaryLeakInsight
  plannedSessions: PlannedCoachSessionItem[]
  traderName?: string | null
  timeZone?: string
}): CommandCenterGreeting {
  const session = detectTradingSession()
  const name = input.traderName?.trim()?.split(" ")[0]
  const hello = name ? `${timeGreeting(input.timeZone)}, ${name}` : timeGreeting(input.timeZone)

  const tvAlerts = input.plannedSessions.filter((s) => s.signal_source === "tradingview").length
  const pendingPlans = input.plannedSessions.length

  let subline = `I'm tracking ${input.snapshot.tradeCount} journal trades`
  if (input.snapshot.todayTradeCount > 0) {
    subline += ` · ${input.snapshot.todayTradeCount} logged today`
  }
  subline += `. ${session.name} is ${session.isActive ? "active" : "closed"}.`

  if (pendingPlans > 0) {
    subline += ` You have ${pendingPlans} planned setup${pendingPlans === 1 ? "" : "s"}`
    if (tvAlerts > 0) subline += ` (${tvAlerts} from TradingView)`
    subline += "."
  }

  if (input.primaryLeak.status === "active") {
    return {
      headline: `${hello} — let's protect your edge.`,
      subline: `${input.primaryLeak.headline} ${subline}`,
      sessionLabel: session.name,
    }
  }

  return {
    headline: `${hello}. Your trading companion is online.`,
    subline,
    sessionLabel: session.name,
  }
}
