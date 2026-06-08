"use client"

import { useEffect, useState } from "react"
import { CalendarDays } from "lucide-react"
import {
  formatCountdownTimer,
  formatImpactLabel,
  getSecondsUntil,
} from "@/lib/economic-calendar/countdown-format"
import { formatPairForSpeech } from "@/lib/economic-calendar/pair-impact"
import type { CalendarNextEvent, EconomicCalendarEvent, TodayCalendarResponse } from "@/lib/economic-calendar/types"

function NextEventCountdown({ nextEvent }: { nextEvent: CalendarNextEvent }) {
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsUntil(nextEvent.dateUtc))

  useEffect(() => {
    setSecondsLeft(getSecondsUntil(nextEvent.dateUtc))
    const timer = window.setInterval(() => {
      setSecondsLeft(getSecondsUntil(nextEvent.dateUtc))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [nextEvent.dateUtc])

  return (
    <div className="mt-3 rounded-[var(--radius-sm)] border border-loss/25 bg-loss/[0.06] px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Next event</p>
          <p className="text-[12px] font-medium text-text-primary">
            {formatImpactLabel()} · {nextEvent.currency}
          </p>
          <p className="text-[12px] leading-relaxed text-text-primary">{nextEvent.event}</p>
          <p className="text-[11px] text-text-muted">{nextEvent.time}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Countdown</p>
          <p className="mt-0.5 font-mono text-[22px] font-semibold tabular-nums leading-none text-loss">
            {formatCountdownTimer(secondsLeft)}
          </p>
        </div>
      </div>
    </div>
  )
}

function EventRow({ event }: { event: EconomicCalendarEvent }) {
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsUntil(event.dateUtc))

  useEffect(() => {
    setSecondsLeft(getSecondsUntil(event.dateUtc))
    const timer = window.setInterval(() => {
      setSecondsLeft(getSecondsUntil(event.dateUtc))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [event.dateUtc])

  return (
    <li className="rounded-[var(--radius-sm)] border border-loss/20 bg-loss/[0.04] px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-[12px] font-medium text-text-primary">{formatImpactLabel(event.impact)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-text-primary">{event.time}</span>
            <span className="text-[11px] font-medium text-text-muted">{event.currency}</span>
          </div>
          <p className="text-[12px] leading-relaxed text-text-primary">{event.event}</p>
          {event.avoidPairs.length > 0 ? (
            <p className="text-[11px] text-text-muted">
              Avoid:{" "}
              <span className="font-medium text-loss/90">
                {event.avoidPairs
                  .slice(0, 5)
                  .map(formatPairForSpeech)
                  .join(", ")}
                {event.avoidPairs.length > 5 ? "…" : ""}
              </span>
            </p>
          ) : null}
        </div>
        <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-loss">
          {formatCountdownTimer(secondsLeft)}
        </span>
      </div>
    </li>
  )
}

export function WarRoomCalendarPanel({
  calendar,
  loading,
}: {
  calendar: TodayCalendarResponse | null | undefined
  loading?: boolean
}) {
  const events = calendar?.events ?? []
  const upcoming = events.filter((event) => getSecondsUntil(event.dateUtc) > 0)

  if (loading) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-3">
        <p className="text-[12px] text-text-muted animate-pulse">Loading economic calendar…</p>
      </div>
    )
  }

  if (!calendar?.connected) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-text-muted" />
          <p className="text-[12px] font-medium text-text-primary">Economic calendar</p>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
          {calendar?.setupMessage ?? "Calendar unavailable right now. Try again in a moment."}
        </p>
      </div>
    )
  }

  if (upcoming.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-text-muted" />
          <p className="text-[12px] font-medium text-text-primary">Economic calendar</p>
        </div>
        <p className="mt-2 text-[12px] text-text-muted">
          No high impact watchlist releases left today.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-text-muted" />
          <p className="text-[12px] font-medium text-text-primary">Economic calendar</p>
        </div>
        <p className="text-[11px] text-text-muted">{upcoming.length} high impact release{upcoming.length === 1 ? "" : "s"}</p>
      </div>

      {calendar.nextEvent ? <NextEventCountdown nextEvent={calendar.nextEvent} /> : null}

      <ul className="mt-3 space-y-2">
        {upcoming.map((event) => (
          <EventRow key={event.dateUtc} event={event} />
        ))}
      </ul>
    </div>
  )
}
