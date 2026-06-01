import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getChapterReview,
  isValidWeekStartParam,
} from "@/lib/weekly-chapters/chapter-review-service"
import {
  resolveWeeklyChapterContext,
  WeeklySummariesTableMissingError,
} from "@/lib/weekly-chapters/server-service"

type RouteContext = {
  params: Promise<{ weekStart: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { weekStart: rawWeek } = await context.params
    const weekStart = decodeURIComponent(rawWeek ?? "").trim()

    if (!isValidWeekStartParam(weekStart)) {
      return NextResponse.json({ error: "Invalid week" }, { status: 400 })
    }

    const { accountId } = await resolveWeeklyChapterContext(supabase, user.id, request)
    if (!accountId) {
      return NextResponse.json({ error: "No active account" }, { status: 400 })
    }

    const review = await getChapterReview(supabase, user.id, accountId, weekStart)
    return NextResponse.json(review)
  } catch (error) {
    if (error instanceof WeeklySummariesTableMissingError) {
      return NextResponse.json({ error: error.message, migrationPending: true }, { status: 503 })
    }
    if (error instanceof Error && /No chapter data/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error("Chapter review GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load chapter review" },
      { status: 500 },
    )
  }
}
