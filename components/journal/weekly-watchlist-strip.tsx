"use client"

import Link from "next/link"
import { Swords } from "lucide-react"
import {
  isWatchlistComplete,
  WEEKLY_WATCHLIST_MAX,
} from "@/lib/strategy-brain/weekly-watchlist"
import type { WeeklyPlanWithPairs } from "@/lib/strategy-brain/types"
import { cn } from "@/lib/utils"

type WeeklyWatchlistStripProps = {
  weekPlan: WeeklyPlanWithPairs | null
  className?: string
  showCoachLinks?: boolean
}

export function WeeklyWatchlistStrip({
  weekPlan,
  className,
  showCoachLinks = false,
}: WeeklyWatchlistStripProps) {
  const pairs = weekPlan?.pairs ?? []
  const complete = isWatchlistComplete(weekPlan)

  if (pairs.length === 0) {
    return (
      <Link
        href="/war-room"
        className={cn(
          "flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/[0.08] px-3 py-2.5 text-[12px] text-warning-foreground/90 transition-colors hover:border-warning/45",
          className,
        )}
      >
        <Swords className="size-4 shrink-0" />
        <span>
          Set your Sunday watchlist in War Room (at least one pair, up to {WEEKLY_WATCHLIST_MAX}).
        </span>
      </Link>
    )
  }

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        complete
          ? "border-cyan-glow/20 bg-cyan-glow/[0.04]"
          : "border-warning/25 bg-warning/[0.06]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
          This week&apos;s pairs
          {pairs.length < 3 ? (
            <span className="ml-1 font-normal normal-case text-muted-foreground/55">
              ({pairs.length} — add more in War Room if you want a broader list)
            </span>
          ) : null}
        </p>
        <Link href="/war-room" className="text-[10px] font-medium text-cyan-glow hover:underline">
          War Room
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {pairs.map((p) =>
          showCoachLinks ? (
            <Link
              key={p.id}
              href={`/?coachPair=${encodeURIComponent(p.pair)}`}
              className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[11px] font-medium text-foreground/90 hover:border-cyan-glow/30"
            >
              {p.pair}
            </Link>
          ) : (
            <span
              key={p.id}
              className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[11px] font-medium text-foreground/90"
            >
              {p.pair}
            </span>
          ),
        )}
      </div>
    </div>
  )
}
