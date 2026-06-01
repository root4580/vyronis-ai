import { formatPairForSpeech, pairContainsCurrency } from "@/lib/economic-calendar/pair-impact"
import type { TodayCalendarResponse } from "@/lib/economic-calendar/types"

function formatTimeForSpeech(timeLabel: string): string {
  return timeLabel.replace(/\sET$/i, "").trim().toLowerCase()
}

export function buildJarvisCalendarLine(snapshot: TodayCalendarResponse | null | undefined): string | null {
  const next = snapshot?.nextHighImpact
  if (!next || next.minutesUntil < 0) return null

  const event = snapshot?.events.find((row) => row.dateUtc === next.dateUtc && row.impact === "high")

  const eventName = event?.event ?? next.event ?? "high impact release"
  const avoidPairs = (event?.avoidPairs ?? []).slice(0, 3).map(formatPairForSpeech)
  const safePairs = (snapshot?.safeToPairs ?? []).slice(0, 2).map(formatPairForSpeech)

  const avoidLine =
    avoidPairs.length > 0
      ? ` Avoid ${avoidPairs.join(" and ")} until after the release.`
      : ""
  const safeLine =
    safePairs.length > 0 ? ` ${safePairs.join(" and ")} are safe.` : ""

  return `Heads up — ${next.currency} ${eventName} at ${formatTimeForSpeech(next.time)}. ${next.minutesUntil} minutes away.${avoidLine}${safeLine}`
}

export function buildRexCalendarLine(snapshot: TodayCalendarResponse | null | undefined): string | null {
  const next = snapshot?.nextHighImpact
  if (!next || next.minutesUntil < 0 || next.minutesUntil > 60) return null
  return "High impact news approaching. Recommend waiting until after the event before any entry."
}

export function buildWarRoomNewsSummary(snapshot: TodayCalendarResponse | null | undefined): {
  active: boolean
  headline: string
  affectedPairs: string[]
  minutesUntil: number | null
  eventLabel: string | null
} {
  const next = snapshot?.nextHighImpact
  if (!next || next.minutesUntil < 0 || next.minutesUntil > 60) {
    return { active: false, headline: "", affectedPairs: [], minutesUntil: null, eventLabel: null }
  }

  const event = snapshot?.events.find((row) => row.dateUtc === next.dateUtc && row.impact === "high")

  const affectedPairs = event?.avoidPairs ?? []
  const eventLabel = event?.event ?? next.event

  return {
    active: true,
    headline: `${next.currency} ${eventLabel} in ${next.minutesUntil} min`,
    affectedPairs,
    minutesUntil: next.minutesUntil,
    eventLabel,
  }
}

export function pairAffectedByUpcomingHighImpact(
  pair: string,
  snapshot: TodayCalendarResponse | null | undefined,
  withinMinutes: number,
): EconomicCalendarEventMatch | null {
  if (!snapshot?.events.length) return null

  for (const event of snapshot.events) {
    if (event.impact !== "high") continue
    if (event.minutesUntil < 0 || event.minutesUntil > withinMinutes) continue
    if (!pairContainsCurrency(pair, event.currency)) continue
    return { event, minutesUntil: event.minutesUntil }
  }

  return null
}

type EconomicCalendarEventMatch = {
  event: TodayCalendarResponse["events"][number]
  minutesUntil: number
}

export type { EconomicCalendarEventMatch }
