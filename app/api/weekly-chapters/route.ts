import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getWeeklyChapterDashboard,
  resolveWeeklyChapterContext,
  WeeklySummariesTableMissingError,
} from "@/lib/weekly-chapters/server-service"
import { toWeekStartISO } from "@/lib/weekly-chapters/week-utils"

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
    const { accountId } = await resolveWeeklyChapterContext(supabase, user.id, request)
    if (!accountId) {
      return NextResponse.json({ error: "No active account" }, { status: 400 })
    }

    const disciplineScore = url.searchParams.get("disciplineScore")
    const disciplineGrade = url.searchParams.get("disciplineGrade")
    const traderFirstName = url.searchParams.get("traderFirstName")

    const dashboard = await getWeeklyChapterDashboard(supabase, user.id, accountId, {
      traderFirstName,
      disciplineScore: disciplineScore != null ? Number(disciplineScore) : null,
      disciplineGrade,
    })

    return NextResponse.json(dashboard)
  } catch (error) {
    if (error instanceof WeeklySummariesTableMissingError) {
      return NextResponse.json(
        {
          chapterNumber: 1,
          weekStart: toWeekStartISO(new Date()),
          weekLabel: "",
          title: "Chapter 1",
          subtitle: "Your fresh start. Your story continues.",
          chapterStreak: 0,
          thisWeek: {
            tradesTaken: 0,
            maxTrades: 2,
            wins: 0,
            losses: 0,
            winRate: 0,
            pnl: 0,
            disciplineScore: null,
            disciplineGrade: null,
          },
          previousChapter: null,
          carryForwardMessage: null,
          mondayMessage: null,
          toughWeekReminder: null,
          hasWinThisWeek: false,
          showSundayComplete: false,
          sundayCompletePreview: null,
          timeline: [],
          migrationPending: true,
        },
        { status: 200 },
      )
    }
    console.error("Weekly chapters GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load weekly chapter" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { accountId } = await resolveWeeklyChapterContext(supabase, user.id, request)
    if (!accountId) {
      return NextResponse.json({ error: "No active account" }, { status: 400 })
    }

    const dashboard = await getWeeklyChapterDashboard(supabase, user.id, accountId)
    return NextResponse.json({ ok: true, dashboard })
  } catch (error) {
    if (error instanceof WeeklySummariesTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Weekly chapters POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not close chapter" },
      { status: 500 },
    )
  }
}
