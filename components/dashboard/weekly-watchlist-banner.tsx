"use client"

import { useEffect, useState } from "react"
import { WeeklyWatchlistStrip } from "@/components/journal/weekly-watchlist-strip"
import { fetchWeeklyPlan } from "@/lib/strategy-brain/api-client"
import type { WeeklyPlanWithPairs } from "@/lib/strategy-brain/types"

export function WeeklyWatchlistBanner({ className }: { className?: string }) {
  const [weekPlan, setWeekPlan] = useState<WeeklyPlanWithPairs | null>(null)

  useEffect(() => {
    void fetchWeeklyPlan()
      .then(setWeekPlan)
      .catch(() => setWeekPlan(null))
  }, [])

  return <WeeklyWatchlistStrip weekPlan={weekPlan} className={className} showCoachLinks />
}
