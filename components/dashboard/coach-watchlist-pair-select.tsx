"use client"

import { useEffect, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchWeeklyPlan } from "@/lib/strategy-brain/api-client"
import {
  buildPlannedContextFromPairPlan,
  getWatchlistPairs,
  isWatchlistComplete,
} from "@/lib/strategy-brain/weekly-watchlist"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import Link from "next/link"

type CoachWatchlistPairSelectProps = {
  plannedContext: PreTradePlannedContext
  disabled?: boolean
  onPairSelected: (context: PreTradePlannedContext) => void | Promise<void>
}

export function CoachWatchlistPairSelect({
  plannedContext,
  disabled,
  onPairSelected,
}: CoachWatchlistPairSelectProps) {
  const [loading, setLoading] = useState(true)
  const [pairs, setPairs] = useState<string[]>([])
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchWeeklyPlan()
      .then((plan) => {
        if (cancelled) return
        const rows = getWatchlistPairs(plan)
        setPairs(rows.map((p) => p.pair))
        setComplete(isWatchlistComplete(plan))
      })
      .catch(() => {
        if (!cancelled) {
          setPairs([])
          setComplete(false)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return null
  }

  if (!complete || pairs.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground/70">
        <Link href="/war-room" className="text-cyan-glow hover:underline">
          War Room
        </Link>{" "}
        — set your weekly pair in War Room before chart coach.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
        This week&apos;s pair
      </p>
      <Select
        disabled={disabled}
        value={plannedContext.pair || undefined}
        onValueChange={(value) => {
          void fetchWeeklyPlan().then((plan) => {
            const row = getWatchlistPairs(plan).find((p) => p.pair === value)
            const next = row
              ? buildPlannedContextFromPairPlan(row, plannedContext.strategy_name ?? undefined)
              : { ...plannedContext, pair: value }
            void onPairSelected(next)
          })
        }}
      >
        <SelectTrigger className="add-trade-input h-10 w-full">
          <SelectValue placeholder="Choose from Sunday watchlist" />
        </SelectTrigger>
        <SelectContent className="z-[70] glass-card border-white/[0.08]">
          {pairs.map((pair) => (
            <SelectItem key={pair} value={pair}>
              {pair}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
