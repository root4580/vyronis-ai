"use client"

import { AlertTriangle } from "lucide-react"
import { buildWarRoomNewsSummary } from "@/lib/economic-calendar/briefing-lines"
import { formatPairForSpeech } from "@/lib/economic-calendar/pair-impact"
import type { TodayCalendarResponse } from "@/lib/economic-calendar/types"

function formatCountdown(minutes: number | null): string {
  if (minutes == null || minutes < 0) return "—"
  if (minutes === 0) return "< 1 min"
  if (minutes === 1) return "1 min"
  return `${minutes} min`
}

export function WarRoomNewsBanner({ calendar }: { calendar: TodayCalendarResponse | null | undefined }) {
  const summary = buildWarRoomNewsSummary(calendar)
  if (!summary.active) return null

  const pairLabels = summary.affectedPairs.slice(0, 6).map(formatPairForSpeech)

  return (
    <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-loss/30 bg-loss/[0.08] px-3.5 py-3">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-loss" />
      <div className="min-w-0 space-y-1">
        <p className="text-[13px] font-medium text-loss">
          High impact news in {formatCountdown(summary.minutesUntil)}
        </p>
        <p className="text-[12px] leading-relaxed text-text-primary">
          {summary.headline}
          {pairLabels.length > 0 ? (
            <>
              {" "}
              · Affected pairs:{" "}
              <span className="font-medium">{pairLabels.join(", ")}</span>
            </>
          ) : null}
        </p>
        <p className="text-[11px] text-text-muted">
          Countdown: {formatCountdown(summary.minutesUntil)} until release · avoid entries on affected pairs
        </p>
      </div>
    </div>
  )
}
