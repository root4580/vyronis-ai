"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Newspaper } from "lucide-react"
import {
  formatCompactCountdown,
  getImpactEmoji,
  getImpactLabel,
  getSecondsUntil,
} from "@/lib/economic-calendar/countdown-format"
import { formatCalendarTimeShort } from "@/lib/economic-calendar/normalize"
import { formatPairForSpeech } from "@/lib/economic-calendar/pair-impact"
import type { CalendarImpact, EconomicCalendarEvent, TodayCalendarResponse } from "@/lib/economic-calendar/types"
import { cn } from "@/lib/utils"

const TRADING_GUIDANCE =
  "Pause new entries 15 minutes before and after red news."

const IMPACT_ORDER: CalendarImpact[] = ["high", "medium", "low"]

function NewsEventRow({ event }: { event: EconomicCalendarEvent }) {
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsUntil(event.dateUtc))

  useEffect(() => {
    setSecondsLeft(getSecondsUntil(event.dateUtc))
    const timer = window.setInterval(() => {
      setSecondsLeft(getSecondsUntil(event.dateUtc))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [event.dateUtc])

  const timeLabel = formatCalendarTimeShort(event.dateUtc)

  return (
    <li
      className={cn(
        "font-mono text-[12px] leading-relaxed text-text-primary",
        event.impact === "high" && secondsLeft <= 15 * 60 && "font-medium text-loss",
      )}
    >
      {timeLabel} {event.currency} {event.event} {getImpactEmoji(event.impact)} (
      {formatCompactCountdown(secondsLeft)})
    </li>
  )
}

function collectAffectedPairs(events: EconomicCalendarEvent[]): string[] {
  const pairs = new Set<string>()
  for (const event of events) {
    if (event.impact !== "high" && event.impact !== "medium") continue
    for (const pair of event.avoidPairs) {
      pairs.add(formatPairForSpeech(pair))
    }
  }
  return [...pairs].sort()
}

export function CouncilNewsRiskBar({
  calendar,
  loading,
}: {
  calendar: TodayCalendarResponse | null | undefined
  loading?: boolean
}) {
  const upcoming = useMemo(() => {
    const events = calendar?.events ?? []
    return events
      .filter((event) => getSecondsUntil(event.dateUtc) > 0)
      .sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime())
      .slice(0, 12)
  }, [calendar?.events])

  const affectedPairs = useMemo(() => collectAffectedPairs(upcoming), [upcoming])
  const hasUrgentHighImpact = upcoming.some(
    (event) => event.impact === "high" && getSecondsUntil(event.dateUtc) <= 60 * 60,
  )

  if (loading) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-3.5">
        <p className="text-[12px] text-text-muted animate-pulse">Loading today&apos;s news events…</p>
      </div>
    )
  }

  if (!calendar?.connected) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-3.5">
        <div className="flex items-center gap-2">
          <Newspaper className="size-4 text-text-muted" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-primary">
            News &amp; Risk Bar
          </p>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
          {calendar?.setupMessage ?? "Calendar unavailable right now. Try again in a moment."}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border px-3.5 py-3.5",
        hasUrgentHighImpact
          ? "border-loss/35 bg-loss/[0.08]"
          : "border-[var(--border-subtle)] bg-[var(--surface-card)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {hasUrgentHighImpact ? (
            <AlertTriangle className="size-4 shrink-0 text-loss" />
          ) : (
            <Newspaper className="size-4 shrink-0 text-text-muted" />
          )}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-accent">
              News &amp; Risk Bar
            </p>
            <p className="mt-0.5 text-[12px] font-medium text-text-primary">Today&apos;s News Events</p>
          </div>
        </div>
        <div className="hidden text-right text-[10px] leading-snug text-text-muted sm:block">
          {IMPACT_ORDER.map((impact) => (
            <p key={impact}>
              {getImpactEmoji(impact)} {getImpactLabel(impact)}
            </p>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-text-muted sm:hidden">
        {IMPACT_ORDER.map((impact) => (
          <span key={impact}>
            {getImpactEmoji(impact)} {getImpactLabel(impact)}
          </span>
        ))}
      </div>

      {upcoming.length === 0 ? (
        <p className="mt-3 text-[12px] text-text-muted">No more watchlist releases scheduled today.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {upcoming.map((event) => (
            <NewsEventRow key={event.dateUtc} event={event} />
          ))}
        </ul>
      )}

      {affectedPairs.length > 0 ? (
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
            Affected Pairs
          </p>
          <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-text-primary">
            {affectedPairs.join(" ")}
          </p>
        </div>
      ) : null}

      <div className="mt-3 rounded-[var(--radius-sm)] border border-warning/20 bg-warning/[0.06] px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-warning-foreground/90">
          Trading Guidance
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-text-primary">
          &ldquo;{TRADING_GUIDANCE}&rdquo;
        </p>
      </div>
    </div>
  )
}
