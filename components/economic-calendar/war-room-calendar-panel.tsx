"use client"

import { CalendarDays } from "lucide-react"
import { formatPairForSpeech } from "@/lib/economic-calendar/pair-impact"
import type { EconomicCalendarEvent, TodayCalendarResponse } from "@/lib/economic-calendar/types"
import { cn } from "@/lib/utils"

function formatCountdown(minutes: number): string {
  if (minutes < 0) return "Passed"
  if (minutes === 0) return "< 1 min"
  if (minutes === 1) return "1 min"
  return `${minutes} min`
}

function ImpactBadge({ impact }: { impact: EconomicCalendarEvent["impact"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        impact === "high"
          ? "bg-loss/15 text-loss"
          : "bg-[var(--warning-bg)] text-[var(--warning-foreground)]",
      )}
    >
      {impact}
    </span>
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
  const upcoming = events.filter((event) => event.minutesUntil >= 0)

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
          {calendar?.setupMessage ?? "Calendar unavailable — add FXStreet credentials to see today’s releases."}
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
          No medium or high impact watchlist releases left today.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-text-muted" />
          <p className="text-[12px] font-medium text-text-primary">Today&apos;s economic calendar</p>
        </div>
        <p className="text-[11px] text-text-muted">{upcoming.length} release{upcoming.length === 1 ? "" : "s"}</p>
      </div>

      <ul className="mt-3 space-y-2">
        {upcoming.map((event) => (
          <li
            key={event.dateUtc}
            className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-input)] px-3 py-2.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-medium text-text-primary">{event.time}</span>
                  <ImpactBadge impact={event.impact} />
                  <span className="text-[11px] font-medium text-text-muted">{event.currency}</span>
                </div>
                <p className="text-[12px] leading-relaxed text-text-primary">{event.event}</p>
                {event.avoidPairs.length > 0 ? (
                  <p className="text-[11px] text-text-muted">
                    Avoid:{" "}
                    {event.avoidPairs
                      .slice(0, 4)
                      .map(formatPairForSpeech)
                      .join(", ")}
                    {event.avoidPairs.length > 4 ? "…" : ""}
                  </p>
                ) : null}
              </div>
              <span
                className={cn(
                  "shrink-0 text-[11px] font-medium",
                  event.impact === "high" && event.minutesUntil <= 60
                    ? "text-loss"
                    : "text-text-muted",
                )}
              >
                {formatCountdown(event.minutesUntil)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
