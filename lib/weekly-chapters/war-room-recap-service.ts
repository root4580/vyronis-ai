import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getWeeklyPlanWithPairs,
  StrategyBrainTableMissingError,
} from "@/lib/strategy-brain/server-service"
import type { WeeklyPlanWithPairs } from "@/lib/strategy-brain/types"
import {
  fetchChapterReviewTradeRows,
  mapChapterRecapTrades,
} from "@/lib/weekly-chapters/chapter-recap-trades"
import {
  buildChapterWarRoomRecap,
  chapterWeekStartFromWarRoomWeek,
  warRoomWeekStartCandidates,
} from "@/lib/weekly-chapters/chapter-war-room-recap"
import type { ChapterReviewTrade, ChapterWarRoomRecap } from "@/lib/weekly-chapters/types"

async function loadWarRoomPlanForChapterWeek(
  supabase: SupabaseClient,
  userId: string,
  chapterWeekStart: string,
): Promise<WeeklyPlanWithPairs | null> {
  for (const weekStart of warRoomWeekStartCandidates(chapterWeekStart)) {
    try {
      const plan = await getWeeklyPlanWithPairs(supabase, userId, weekStart)
      if (plan) return plan
    } catch (error) {
      if (error instanceof StrategyBrainTableMissingError) {
        return null
      }
    }
  }
  return null
}

export async function buildChapterWarRoomRecapForWeek(input: {
  supabase: SupabaseClient
  userId: string
  chapterWeekStart: string
  trades: ChapterReviewTrade[]
}): Promise<ChapterWarRoomRecap | null> {
  const plan = await loadWarRoomPlanForChapterWeek(
    input.supabase,
    input.userId,
    input.chapterWeekStart,
  )
  return buildChapterWarRoomRecap({ plan, trades: input.trades })
}

export async function getChapterWarRoomRecapForWarRoomWeek(input: {
  supabase: SupabaseClient
  userId: string
  accountId: string
  legacyAccountId: string | null
  warRoomWeekStart: string
}): Promise<ChapterWarRoomRecap | null> {
  const chapterWeekStart = chapterWeekStartFromWarRoomWeek(input.warRoomWeekStart)
  const tradeRows = await fetchChapterReviewTradeRows(
    input.supabase,
    input.userId,
    input.accountId,
    input.legacyAccountId,
  )
  const trades = mapChapterRecapTrades(tradeRows, chapterWeekStart)
  return buildChapterWarRoomRecapForWeek({
    supabase: input.supabase,
    userId: input.userId,
    chapterWeekStart,
    trades,
  })
}
