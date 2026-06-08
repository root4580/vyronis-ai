"use client"

import { useEffect, useMemo, useState } from "react"
import { ExternalLink, Folder } from "lucide-react"
import {
  formatCompactCountdown,
  getImpactColorClass,
  getImpactLabel,
  getSecondsUntil,
} from "@/lib/economic-calendar/countdown-format"
import {
  formatCalendarDayLabel,
  formatCalendarTimeShort,
} from "@/lib/economic-calendar/normalize"
import type { CalendarImpact, EconomicCalendarEvent } from "@/lib/economic-calendar/types"
import { cn } from "@/lib/utils"

const FOREX_FACTORY_CALENDAR_URL = "https://www.forexfactory.com/calendar"

function ImpactIcon({ impact }: { impact: CalendarImpact }) {
  return (
    <span
      className="inline-flex shrink-0"
      title={getImpactLabel(impact)}
      aria-label={getImpactLabel(impact)}
    >
      <Folder
        className={cn("size-4 fill-current", getImpactColorClass(impact))}
        strokeWidth={1.5}
      />
    </span>
  )
}

function DataCell({ value }: { value: string | null }) {
  return (
    <td className="px-2 py-1.5 text-right font-mono text-[11px] tabular-nums text-text-primary">
      {value?.trim() ? value : "—"}
    </td>
  )
}

function CalendarEventRow({
  event,
  showDate,
}: {
  event: EconomicCalendarEvent
  showDate: boolean
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsUntil(event.dateUtc))
  const isPast = secondsLeft <= 0

  useEffect(() => {
    setSecondsLeft(getSecondsUntil(event.dateUtc))
    const timer = window.setInterval(() => {
      setSecondsLeft(getSecondsUntil(event.dateUtc))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [event.dateUtc])

  const dateLabel = formatCalendarDayLabel(event.dateUtc)
  const timeLabel = formatCalendarTimeShort(event.dateUtc)

  return (
    <tr
      className={cn(
        "border-b border-[var(--border-subtle)] transition-colors hover:bg-white/[0.03]",
        isPast && "opacity-60",
        event.impact === "high" && !isPast && secondsLeft <= 15 * 60 && "bg-loss/[0.06]",
      )}
    >
      <td className="whitespace-nowrap px-2 py-1.5 text-[11px] text-text-muted">
        {showDate ? dateLabel.replace("Today: ", "") : ""}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11px] tabular-nums text-text-primary">
        {timeLabel}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-[11px] font-semibold text-text-primary">
        {event.currency}
      </td>
      <td className="px-2 py-1.5">
        <ImpactIcon impact={event.impact} />
      </td>
      <td className="min-w-[10rem] px-2 py-1.5 text-[11px] leading-snug text-text-primary">
        {event.event}
      </td>
      <DataCell value={event.actual} />
      <DataCell value={event.forecast} />
      <DataCell value={event.previous} />
      <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-[10px] tabular-nums text-text-muted">
        {isPast ? "Released" : formatCompactCountdown(secondsLeft)}
      </td>
    </tr>
  )
}

export function EconomicCalendarTable({
  events,
  dayTitle,
  className,
}: {
  events: EconomicCalendarEvent[]
  dayTitle?: string
  className?: string
}) {
  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime(),
      ),
    [events],
  )

  const headerDay =
    dayTitle ?? (sorted[0] ? formatCalendarDayLabel(sorted[0].dateUtc) : "Today")

  if (sorted.length === 0) {
    return (
      <p className="px-2 py-3 text-[12px] text-text-muted">
        No watchlist-currency releases scheduled for today.
      </p>
    )
  }

  return (
    <div className={cn("overflow-hidden", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-white/[0.03] px-2 py-2">
        <p className="text-[12px] font-semibold text-text-primary">{headerDay}</p>
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Folder className="size-3.5 fill-current text-loss" strokeWidth={1.5} /> High
          </span>
          <span className="inline-flex items-center gap-1">
            <Folder className="size-3.5 fill-current text-warning" strokeWidth={1.5} /> Medium
          </span>
          <span className="inline-flex items-center gap-1">
            <Folder className="size-3.5 fill-current text-yellow-400" strokeWidth={1.5} /> Low
          </span>
          <span>· ET</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-white/[0.04] text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted">
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Time</th>
              <th className="px-2 py-2">Currency</th>
              <th className="px-2 py-2">Impact</th>
              <th className="px-2 py-2">Event</th>
              <th className="px-2 py-2 text-right">Actual</th>
              <th className="px-2 py-2 text-right">Forecast</th>
              <th className="px-2 py-2 text-right">Previous</th>
              <th className="px-2 py-2 text-right">Countdown</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((event, index) => {
              const prev = sorted[index - 1]
              const showDate =
                index === 0 ||
                formatCalendarDayLabel(prev!.dateUtc) !== formatCalendarDayLabel(event.dateUtc)
              return (
                <CalendarEventRow key={event.dateUtc} event={event} showDate={showDate} />
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-2 py-1.5">
        <p className="text-[10px] text-text-muted">
          Actual fills in on Forex Factory after each release — this feed only ships forecast and previous.
        </p>
        <a
          href={FOREX_FACTORY_CALENDAR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-[10px] text-text-muted hover:text-text-accent"
        >
          Full calendar on Forex Factory
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  )
}
