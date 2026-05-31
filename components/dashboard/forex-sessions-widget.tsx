"use client"

import { useEffect, useState } from "react"
import {
  FOREX_TIMELINE_LABELS,
  getForexSessionSnapshots,
  getForexTimelineNowPercent,
  getLocalClock,
  localMinuteToTimelinePercent,
} from "@/lib/trading/forex-sessions"
import { cn } from "@/lib/utils"

type ForexSessionsWidgetProps = {
  className?: string
}

export function ForexSessionsWidget({ className }: ForexSessionsWidgetProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const local = getLocalClock(now)
  const sessions = getForexSessionSnapshots(now)
  const nowPercent = getForexTimelineNowPercent(local.totalMinutes)

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="section-label">Sessions</p>
        <p className="text-[10px] tabular-nums text-text-muted">
          {now.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })}{" "}
          local
        </p>
      </div>

      <div className="relative rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-black/20 px-2 pb-2 pt-5">
        <div className="relative mb-1 h-3">
          {FOREX_TIMELINE_LABELS.map(({ localMinutes, label }) => (
            <span
              key={label}
              className="absolute top-0 -translate-x-1/2 text-[8px] text-text-muted"
              style={{ left: `${localMinuteToTimelinePercent(localMinutes)}%` }}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="relative space-y-1.5">
          <div
            className="pointer-events-none absolute inset-y-0 z-10 w-px bg-profit shadow-[0_0_8px_rgb(from_var(--color-profit)_r_g_b_/_0.55)]"
            style={{ left: `${nowPercent}%` }}
            aria-hidden
          />

          {sessions.map((session) => (
            <div key={session.id} className="grid grid-cols-[minmax(0,118px)_1fr] items-center gap-2">
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-[11px] font-medium",
                    session.isOpen ? "text-text-primary" : "text-text-muted",
                  )}
                >
                  {session.label}
                </p>
                <p className="truncate text-[9px] tabular-nums text-text-muted">{session.localTimeLabel}</p>
                {!session.isOpen && session.countdownLabel ? (
                  <p className="truncate text-[8px] tabular-nums text-text-accent/80">
                    {session.countdownLabel}
                  </p>
                ) : null}
              </div>

              <div className="relative h-5 overflow-hidden rounded-[3px] bg-white/[0.04]">
                {session.barSegments.map((segment, index) => (
                  <div
                    key={`${session.id}-${index}`}
                    className="absolute inset-y-0 rounded-[2px]"
                    style={{
                      left: `${segment.leftPercent}%`,
                      width: `${segment.widthPercent}%`,
                      backgroundColor: session.accent,
                      opacity: session.isOpen ? 0.5 : 0.18,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
