"use client"

import { useEffect, useState } from "react"
import { chapterWeekStartFromWarRoomWeek } from "@/lib/weekly-chapters/chapter-war-room-recap"
import type { ChapterWarRoomRecap } from "@/lib/weekly-chapters/types"
import { getChapterReviewHref } from "@/lib/dashboard-nav"
import {
  ChapterWarRoomRecapSection,
  ChapterWarRoomRecapSkeleton,
} from "@/components/weekly-chapters/chapter-war-room-recap-section"

type WarRoomChapterRecapPanelProps = {
  accountId: string | null
  warRoomWeekStart: string
}

function isSundayEveningNow(): boolean {
  const now = new Date()
  return now.getDay() === 0 && now.getHours() >= 18
}

export function WarRoomChapterRecapPanel({
  accountId,
  warRoomWeekStart,
}: WarRoomChapterRecapPanelProps) {
  const [recap, setRecap] = useState<ChapterWarRoomRecap | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!accountId || !isSundayEveningNow()) {
      setRecap(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    const params = new URLSearchParams({
      weekStart: warRoomWeekStart,
      accountId,
    })

    void fetch(`/api/war-room/chapter-recap?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) return null
        return response.json() as Promise<ChapterWarRoomRecap | null>
      })
      .then((payload) => {
        if (cancelled) return
        setRecap(payload)
      })
      .catch(() => {
        if (!cancelled) setRecap(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accountId, warRoomWeekStart])

  if (!isSundayEveningNow() || hidden) {
    return null
  }

  if (isLoading) {
    return <ChapterWarRoomRecapSkeleton compact />
  }

  if (!recap) {
    return null
  }

  const chapterWeek = chapterWeekStartFromWarRoomWeek(warRoomWeekStart)

  return (
    <div className="space-y-2">
      <ChapterWarRoomRecapSection
        recap={recap}
        compact
        chapterReviewHref={`${getChapterReviewHref(chapterWeek)}#war-room-recap`}
      />
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="text-[10px] text-text-muted hover:text-cyan-glow"
      >
        Hide recap for tonight
      </button>
    </div>
  )
}
