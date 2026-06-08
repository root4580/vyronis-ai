"use client"

import { useMemo } from "react"
import { AlertTriangle, Newspaper } from "lucide-react"
import { EconomicCalendarTable } from "@/components/economic-calendar/economic-calendar-table"
import { sanitizeCalendarMessage } from "@/lib/economic-calendar/calendar-errors"
import { getSecondsUntil } from "@/lib/economic-calendar/countdown-format"
import { formatPairForSpeech } from "@/lib/economic-calendar/pair-impact"
import type { EconomicCalendarEvent, TodayCalendarResponse } from "@/lib/economic-calendar/types"
import { cn } from "@/lib/utils"

const TRADING_GUIDANCE =
  "Pause new entries 15 minutes before and after red news."

function collectAffectedPairs(events: EconomicCalendarEvent[]): string[] {
  const pairs = new Set<string>()
  for (const event of events) {
    if (event.impact !== "high" && event.impact !== "medium") continue
    if (getSecondsUntil(event.dateUtc) <= 0) continue
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
  const todayEvents = useMemo(() => calendar?.events ?? [], [calendar?.events])

  const upcomingHighImpact = useMemo(
    () =>
      todayEvents.some(
        (event) =>
          event.impact === "high" &&
          getSecondsUntil(event.dateUtc) > 0 &&
          getSecondsUntil(event.dateUtc) <= 60 * 60,
      ),
    [todayEvents],
  )

  const affectedPairs = useMemo(() => collectAffectedPairs(todayEvents), [todayEvents])

  if (loading) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-3.5">
        <p className="text-[12px] text-text-muted animate-pulse">Loading economic calendar…</p>
      </div>
    )
  }

  if (!calendar?.connected) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-3.5">
        <div className="flex items-center gap-2">
          <Newspaper className="size-4 text-text-muted" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-primary">
            Economic Calendar
          </p>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
          {sanitizeCalendarMessage(calendar?.setupMessage)}
        </p>
        <a
          href="https://www.forexfactory.com/calendar"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[11px] font-medium text-text-accent hover:underline"
        >
          Open Forex Factory calendar
        </a>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-md)] border",
        upcomingHighImpact
          ? "border-loss/35 bg-loss/[0.06]"
          : "border-[var(--border-subtle)] bg-[var(--surface-card)]",
      )}
    >
      <div className="flex items-start gap-2 border-b border-[var(--border-subtle)] px-3.5 py-3">
        {upcomingHighImpact ? (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-loss" />
        ) : (
          <Newspaper className="mt-0.5 size-4 shrink-0 text-text-muted" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-accent">
            News &amp; Risk Bar
          </p>
          <p className="mt-0.5 text-[12px] text-text-muted">
            Live feed from Forex Factory · USD, EUR, GBP, JPY, AUD, NZD, CAD, CHF
          </p>
        </div>
      </div>

      {calendar?.stale ? (
        <div className="border-b border-warning/25 bg-warning/[0.08] px-3.5 py-2">
          <p className="text-[11px] leading-relaxed text-warning-foreground/90">
            {sanitizeCalendarMessage(calendar.setupMessage)}
          </p>
        </div>
      ) : null}

      <EconomicCalendarTable events={todayEvents} />

      {affectedPairs.length > 0 ? (
        <div className="border-t border-[var(--border-subtle)] px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
            Affected Pairs
          </p>
          <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-text-primary">
            {affectedPairs.join(" · ")}
          </p>
        </div>
      ) : null}

      <div className="border-t border-[var(--border-subtle)] px-3.5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-warning-foreground/90">
          Trading Guidance
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-text-primary">
          {TRADING_GUIDANCE}
        </p>
      </div>
    </div>
  )
}
