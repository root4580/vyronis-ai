import type { SupabaseClient } from "@supabase/supabase-js"
import {
  resolveActiveAccountId,
  resolveLegacyTradeAccountId,
} from "@/lib/accounts/server-active-account"
import {
  buildChapterOpeningMessage,
  buildMilestoneCelebration,
  buildWeeklyCoachReviewMessage,
  PRE_TRADE_TOGETHER_LINE,
} from "@/lib/coach-chapters/personality"
import type { CoachChapterContext, CoachMilestone } from "@/lib/coach-chapters/types"
import {
  detectNewMilestones,
  getOrCreateCoachMemory,
  incrementCoachMemorySession,
} from "@/lib/coach-chapters/memory-service"
import { getWeeklyChapterDashboard } from "@/lib/weekly-chapters/server-service"
import { listWeeklySummaries } from "@/lib/weekly-chapters/server-service"
import { computeChapterStreak } from "@/lib/weekly-chapters/key-lesson"
import { isTradeInWeekStart, toWeekStartISO } from "@/lib/weekly-chapters/week-utils"
import type { WeeklySummaryRecord } from "@/lib/weekly-chapters/types"

async function loadTraderFirstName(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("user_profiles")
    .select("first_name")
    .eq("user_id", userId)
    .maybeSingle()
  return data?.first_name?.trim() || "Trader"
}

async function countCoachSessionsThisWeek(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  legacyAccountId: string | null,
  weekStart: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("trade_coach_sessions")
    .select("created_at, updated_at")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .limit(200)

  if (error) return 0

  return (data ?? []).filter((row) => {
    const raw = String(row.updated_at ?? row.created_at ?? "")
    const date = raw.slice(0, 10)
    return isTradeInWeekStart({ trade_date: date, created_at: raw }, weekStart)
  }).length
}

export async function loadCoachChapterContext(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  options?: { traderFirstName?: string | null },
): Promise<CoachChapterContext> {
  const legacyAccountId = await resolveLegacyTradeAccountId(supabase, userId)
  const firstName =
    options?.traderFirstName?.trim() ||
    (await loadTraderFirstName(supabase, userId))

  const summaries = await listWeeklySummaries(
    supabase,
    userId,
    accountId,
    legacyAccountId,
    12,
  ).catch(() => [] as WeeklySummaryRecord[])

  const currentWeekStart = toWeekStartISO(new Date())
  const closedChapters = summaries.filter((row) => row.week_start < currentWeekStart)
  const recentChapters = closedChapters.slice(0, 3)
  const recentChapter = closedChapters[0] ?? null
  const chapterStreak = computeChapterStreak(closedChapters)

  const dashboard = await getWeeklyChapterDashboard(supabase, userId, accountId, {
    traderFirstName: firstName,
  }).catch(() => ({
    chapterNumber: recentChapter?.chapter_number ? recentChapter.chapter_number + 1 : 1,
  }))

  const coachSessionsThisWeek = await countCoachSessionsThisWeek(
    supabase,
    userId,
    accountId,
    legacyAccountId,
    currentWeekStart,
  )

  const memory = await getOrCreateCoachMemory(supabase, userId, accountId).catch(() => null)
  const newMilestones = detectNewMilestones({
    memory,
    chapterStreak,
    recentChapter,
    closedChapters,
  })

  const openingMessage = [
    buildChapterOpeningMessage({ firstName, recentChapter }),
    PRE_TRADE_TOGETHER_LINE,
  ].join("\n\n")

  const weeklyCoachReview =
    recentChapter && isSundayReviewWindow()
      ? buildWeeklyCoachReviewMessage({
          firstName,
          chapterNumber: recentChapter.chapter_number,
          narrativeLines: buildWeeklyNarrative(recentChapter, coachSessionsThisWeek),
          carryForwardLesson: recentChapter.key_lesson || "Protect process over outcome.",
        })
      : null

  return {
    traderFirstName: firstName,
    currentChapterNumber: dashboard.chapterNumber,
    recentChapters,
    chapterStreak,
    coachSessionsThisWeek,
    openingMessage,
    preTradeFraming: PRE_TRADE_TOGETHER_LINE,
    weeklyCoachReview,
    newMilestones,
    memory,
  }
}

function isSundayReviewWindow(now = new Date()): boolean {
  return now.getDay() === 0 && now.getHours() >= 18
}

function buildWeeklyNarrative(chapter: WeeklySummaryRecord, coachSessions: number): string[] {
  const lines: string[] = []
  if (chapter.trades_taken > 0) {
    lines.push(
      `You logged ${chapter.trades_taken} trade${chapter.trades_taken === 1 ? "" : "s"} with ${chapter.win_rate}% win rate.`,
    )
  }
  if (coachSessions > 0) {
    lines.push(`Coach sessions this week: ${coachSessions}.`)
  }
  if (chapter.key_lesson) {
    lines.push(`Key coaching insight: ${chapter.key_lesson}`)
  }
  if (chapter.pnl < 0 && chapter.losses > 0) {
    lines.push(
      "That's not failure. That's refinement — direction can be right while timing gets sharpened.",
    )
  }
  return lines.length > 0 ? lines : ["You showed up and stayed in process — that matters."]
}

export function formatMilestoneMessages(milestones: CoachMilestone[]): string[] {
  return milestones.map((milestone) => buildMilestoneCelebration(milestone))
}

export async function resolveCoachChapterAccount(
  supabase: SupabaseClient,
  userId: string,
  request?: Request,
): Promise<string | null> {
  return resolveActiveAccountId(supabase, userId, request)
}

export async function finalizeCoachChapterSession(
  supabase: SupabaseClient,
  userId: string,
  session: {
    id: string
    account_id?: string | null
    planned_context?: { coach_analysis?: { summary?: string; tradeQuality?: { grade?: string } } }
    quality_grade?: string | null
  },
  chapterNumber: number,
): Promise<void> {
  const insight =
    session.planned_context?.coach_analysis?.summary?.trim() ||
    session.planned_context?.coach_analysis?.tradeQuality?.grade ||
    null

  const payload: Record<string, unknown> = {
    week_chapter: chapterNumber,
    session_type: "pre_trade",
    key_insight: insight,
    outcome: session.quality_grade ?? null,
    updated_at: new Date().toISOString(),
  }

  try {
    await supabase
      .from("trade_coach_sessions")
      .update(payload)
      .eq("id", session.id)
      .eq("user_id", userId)
  } catch {
    // Optional columns until migrated
  }

  if (session.account_id) {
    await incrementCoachMemorySession(supabase, userId, session.account_id, insight).catch(
      () => undefined,
    )
  }
}
