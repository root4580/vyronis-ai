import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  loadCoachChapterContext,
  resolveCoachChapterAccount,
} from "@/lib/coach-chapters/context-service"
import { persistCoachMilestones } from "@/lib/coach-chapters/memory-service"

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
    const accountId = await resolveCoachChapterAccount(supabase, user.id, request)
    if (!accountId) {
      return NextResponse.json({ error: "No active account" }, { status: 400 })
    }

    const traderFirstName = url.searchParams.get("traderFirstName")
    const context = await loadCoachChapterContext(supabase, user.id, accountId, {
      traderFirstName,
    })

    if (context.newMilestones.length > 0) {
      await persistCoachMilestones(
        supabase,
        user.id,
        accountId,
        context.newMilestones,
      ).catch(() => undefined)
    }

    return NextResponse.json(context)
  } catch (error) {
    console.error("Coach chapter context GET error:", error)
    return NextResponse.json(
      {
        traderFirstName: "Trader",
        currentChapterNumber: 1,
        recentChapters: [],
        chapterStreak: 0,
        coachSessionsThisWeek: 0,
        openingMessage: "I'm here with you — let's look at this setup together.",
        preTradeFraming: "Let's look at this together.",
        weeklyCoachReview: null,
        newMilestones: [],
        memory: null,
      },
      { status: 200 },
    )
  }
}
