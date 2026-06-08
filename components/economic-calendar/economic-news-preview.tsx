"use client"

import Link from "next/link"
import { ArrowRight, Newspaper } from "lucide-react"
import {
  formatCompactCountdown,
  getImpactEmoji,
  getSecondsUntil,
} from "@/lib/economic-calendar/countdown-format"
import { formatCalendarTimeShort } from "@/lib/economic-calendar/normalize"
import { getNewsHref } from "@/lib/dashboard-nav"
import { useEconomicCalendar } from "@/hooks/use-economic-calendar"

export function EconomicNewsPreview() {
  const { calendar, loading } = useEconomicCalendar()

  const nextEvent = calendar?.nextEvent ?? calendar?.nextHighImpact ?? null
  const upcomingCount =
    calendar?.events.filter((event) => getSecondsUntil(event.dateUtc) > 0).length ?? 0

  return (
    <Link
      href={getNewsHref()}
      className="block rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-3 transition-colors hover:border-cyan-glow/25 hover:bg-cyan-glow/[0.04]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Newspaper className="mt-0.5 size-4 shrink-0 text-cyan-glow" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-accent">
              Economic Calendar
            </p>
            {loading ? (
              <p className="mt-1 text-[12px] text-text-muted animate-pulse">Loading today&apos;s news…</p>
            ) : nextEvent ? (
              <p className="mt-1 text-[12px] leading-snug text-text-primary">
                Next: {formatCalendarTimeShort(nextEvent.dateUtc)} {nextEvent.currency}{" "}
                {nextEvent.event} {getImpactEmoji(nextEvent.impact)} (
                {formatCompactCountdown(getSecondsUntil(nextEvent.dateUtc))})
              </p>
            ) : (
              <p className="mt-1 text-[12px] text-text-muted">
                {upcomingCount > 0
                  ? `${upcomingCount} release${upcomingCount === 1 ? "" : "s"} left today`
                  : "No more watchlist releases today"}
              </p>
            )}
          </div>
        </div>
        <ArrowRight className="size-4 shrink-0 text-text-muted" />
      </div>
    </Link>
  )
}
