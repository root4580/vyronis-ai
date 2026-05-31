import type { SupabaseClient } from "@supabase/supabase-js"
import { MTF_TIMEFRAME_IDS, type CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import { getWeeklyPlanWithPairs } from "@/lib/strategy-brain/server-service"
import { getWeekStartSunday } from "@/lib/strategy-brain/week-utils"
import {
  countMtfScreenshots,
  getMtfScreenshotsFromSession,
} from "@/lib/trade-coach/mtf-session"
import type { TradeCoachSessionWithMessages } from "@/lib/trade-coach/types"
import { normalizeSymbolForWarRoom } from "@/lib/tradingview/signal-war-room-grader"

type SubmitMtfScreenshot = (
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  timeframe: CoachMtfTimeframe,
  chartUrl: string,
) => Promise<TradeCoachSessionWithMessages>

function normalizePair(pair: string): string {
  return normalizeSymbolForWarRoom(pair)
}

/** Map War Room screenshot_urls (W → M15 order) onto coach MTF slots. */
export function mapWarRoomUrlsToMtfSlots(urls: string[]): Partial<Record<CoachMtfTimeframe, string>> {
  const cleaned = urls.map((url) => url.trim()).filter(Boolean)
  const map: Partial<Record<CoachMtfTimeframe, string>> = {}

  for (let index = 0; index < Math.min(cleaned.length, MTF_TIMEFRAME_IDS.length); index++) {
    map[MTF_TIMEFRAME_IDS[index]] = cleaned[index]
  }

  return map
}

export async function hydrateCoachSessionFromWarRoom(
  supabase: SupabaseClient,
  userId: string,
  session: TradeCoachSessionWithMessages,
  pair: string,
  submitMtfScreenshot: SubmitMtfScreenshot,
): Promise<TradeCoachSessionWithMessages> {
  if (countMtfScreenshots(getMtfScreenshotsFromSession(session)) > 0) {
    return session
  }

  const normalizedPair = normalizePair(pair)
  if (!normalizedPair) return session

  try {
    const weekPlan = await getWeeklyPlanWithPairs(supabase, userId, getWeekStartSunday())
    const pairPlan = weekPlan?.pairs.find(
      (row) => normalizePair(row.pair) === normalizedPair,
    )
    const slotMap = mapWarRoomUrlsToMtfSlots(pairPlan?.screenshot_urls ?? [])
    const entries = MTF_TIMEFRAME_IDS.filter((timeframe) => slotMap[timeframe])

    if (entries.length === 0) {
      return session
    }

    let hydrated = session
    for (const timeframe of entries) {
      const url = slotMap[timeframe]
      if (!url) continue
      hydrated = await submitMtfScreenshot(supabase, userId, hydrated.id, timeframe, url)
    }

    return hydrated
  } catch {
    return session
  }
}
