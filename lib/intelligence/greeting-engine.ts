import { detectTradingSession } from "@/lib/trading/session-timing"
import type { CommandCenterGreeting, CommandCenterTraderSnapshot } from "@/lib/command-center/types"
import type { PrimaryLeakInsight } from "@/lib/behavior/types"
import type { PlannedCoachSessionItem } from "@/lib/trade-coach/types"

/** Local time-of-day greeting — midnight–4:59 is not "morning". */
export function getTimeOfDayGreeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return "Good morning"
  if (hour >= 12 && hour < 17) return "Good afternoon"
  if (hour >= 17 && hour < 22) return "Good evening"
  return "Good night"
}

function timeGreeting(): string {
  return getTimeOfDayGreeting()
}

export function buildContextualGreeting(input: {
  snapshot: CommandCenterTraderSnapshot
  primaryLeak: PrimaryLeakInsight
  plannedSessions: PlannedCoachSessionItem[]
  traderName?: string | null
}): CommandCenterGreeting {
  const session = detectTradingSession()
  const name = input.traderName?.trim()?.split(" ")[0]
  const hello = name ? `${timeGreeting()}, ${name}` : timeGreeting()

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
