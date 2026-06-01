import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isValidWeekStartParam } from "@/lib/weekly-chapters/chapter-review-service"
import { resolveWeeklyChapterContext } from "@/lib/weekly-chapters/server-service"
import { getChapterWarRoomRecapForWarRoomWeek } from "@/lib/weekly-chapters/war-room-recap-service"
import { getWeekStartSunday } from "@/lib/strategy-brain/week-utils"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const warRoomWeekStart = (url.searchParams.get("weekStart") ?? getWeekStartSunday()).trim()
    if (!isValidWeekStartParam(warRoomWeekStart)) {
      return NextResponse.json({ error: "Invalid week" }, { status: 400 })
    }

    const { accountId, legacyAccountId } = await resolveWeeklyChapterContext(
      supabase,
      user.id,
      request,
    )
    if (!accountId) {
      return NextResponse.json({ error: "No active account" }, { status: 400 })
    }

    const recap = await getChapterWarRoomRecapForWarRoomWeek({
      supabase,
      userId: user.id,
      accountId,
      legacyAccountId,
      warRoomWeekStart,
    })

    return NextResponse.json(recap)
  } catch (error) {
    console.error("War Room chapter recap GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load recap" },
      { status: 500 },
    )
  }
}
