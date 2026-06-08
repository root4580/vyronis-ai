import { formatPairForSpeech } from "@/lib/economic-calendar/pair-impact"
import type { TodayCalendarResponse } from "@/lib/economic-calendar/types"

export function isCouncilNewsRequest(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false

  return (
    /\b(news|headlines|calendar|economic calendar|high impact|red folder|nfp|cpi|fomc|rate decision)\b/i.test(
      trimmed,
    ) ||
    /\b(any|what).{0,20}(?:news|releases?|events?)\b/i.test(trimmed) ||
    /\b(news|releases?).{0,16}(?:today|this week|tonight)\b/i.test(trimmed) ||
    /\bdo we have news\b/i.test(trimmed)
  )
}

export function formatCouncilNewsCalendarBlock(
  calendar: TodayCalendarResponse | null | undefined,
): string {
  if (!calendar) {
    return "[TODAY'S NEWS]\nEconomic calendar not loaded — open War Room to connect FXStreet."
  }

  if (!calendar.connected) {
    return `[TODAY'S NEWS]\n${calendar.setupMessage ?? "Economic calendar is not connected."}`
  }

  const highImpact = calendar.events.filter((event) => event.impact === "high")
  if (highImpact.length === 0) {
    return "[TODAY'S NEWS]\nNo high-impact releases on your watchlist currencies for the rest of today."
  }

  const lines = highImpact.slice(0, 10).map((event) => {
    const timing =
      event.minutesUntil < 0
        ? "passed"
        : event.minutesUntil === 0
          ? "now"
          : `in ${event.minutesUntil}m`
    const avoid =
      event.avoidPairs.length > 0
        ? ` · Avoid ${event.avoidPairs.slice(0, 4).map(formatPairForSpeech).join(", ")}`
        : ""
    return `${event.time} · ${event.currency} · ${event.event} · ${timing}${avoid}`
  })

  const safe =
    calendar.safeToPairs.length > 0
      ? `\nSafe to trade: ${calendar.safeToPairs.slice(0, 4).map(formatPairForSpeech).join(", ")}.`
      : ""

  return ["[TODAY'S NEWS — HIGH IMPACT]", ...lines].join("\n") + safe
}

export function buildCouncilNewsScopeInstruction(
  calendar: TodayCalendarResponse | null | undefined,
): string {
  const block = formatCouncilNewsCalendarBlock(calendar)
  return [
    "DATA SCOPE — ECONOMIC NEWS:",
    "Answer from the TODAY'S NEWS block below. Quote specific times, currencies, events, and pairs to avoid.",
    "Do not give generic mindset advice — the trader asked for the calendar / news.",
    "If nothing is scheduled, say clearly there is no high-impact news on their watchlist today.",
    block,
  ].join("\n\n")
}

export function buildCouncilNewsUserPrompt(input: {
  question: string
  traderFirstName: string
  recentTranscript: string
  calendar: TodayCalendarResponse | null | undefined
  agentName: string
}): string {
  return [
    buildCouncilNewsScopeInstruction(input.calendar),
    input.recentTranscript ? `Today's conversation so far:\n${input.recentTranscript}` : "",
    `${input.traderFirstName} asked: ${input.question}`,
    `Respond as ${input.agentName} — economic calendar only. Two or three short sentences with exact event details.`,
  ]
    .filter(Boolean)
    .join("\n\n")
}

export function buildJarvisNewsIntro(traderFirstName: string): string {
  return `${traderFirstName}, pulling today's high-impact calendar for your watchlist.`
}

export function buildJarvisNewsFallback(
  calendar: TodayCalendarResponse | null | undefined,
): string {
  const next = calendar?.nextHighImpact
  if (!next || next.minutesUntil < 0) {
    return "No high-impact news left on your watchlist today — trade your plan with normal risk rules."
  }
  const avoid = calendar?.events.find((e) => e.dateUtc === next.dateUtc)?.avoidPairs ?? []
  const avoidLine =
    avoid.length > 0
      ? ` Stand down on ${avoid.slice(0, 2).map(formatPairForSpeech).join(" and ")} until after the print.`
      : ""
  return `Next up: ${next.currency} ${next.event} at ${next.time.replace(/\sET$/i, "")} — about ${next.minutesUntil} minutes.${avoidLine}`
}
