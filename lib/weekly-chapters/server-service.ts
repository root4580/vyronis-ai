import type { SupabaseClient } from "@supabase/supabase-js"
import {
  accountScopeOrFilter,
  resolveActiveAccountId,
  resolveLegacyTradeAccountId,
} from "@/lib/accounts/server-active-account"
import { getTradingAccount } from "@/lib/accounts/trading-account-service"
import { listPaperTrades, PaperTradesTableMissingError } from "@/lib/paper-trades/paper-trade-service"
import type { PaperTradeRecord } from "@/lib/paper-trades/types"
import { buildWeeklyChapterDashboard } from "@/lib/weekly-chapters/engine"
import {
  buildKeyLesson,
  computeWeekTradeStats,
} from "@/lib/weekly-chapters/key-lesson"
import { computeWeeklyChapterPaperStats } from "@/lib/weekly-chapters/paper-stats"
import type { ChapterTradeRow, WeeklyChapterDashboard, WeeklySummaryRecord } from "@/lib/weekly-chapters/types"
import { isTradeInWeekStart, resolveOriginWeekStart, toWeekStartISO, computeChapterNumber, disciplineGradeFromScore, getNextWeekStartISO } from "@/lib/weekly-chapters/week-utils"
import { generateWeeklyReviewForUser } from "@/lib/weekly-review/server-service"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"

function normalizeSummary(row: Record<string, unknown>): WeeklySummaryRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    account_id: row.account_id != null ? String(row.account_id) : null,
    week_start: String(row.week_start).slice(0, 10),
    trades_taken: Number(row.trades_taken ?? 0),
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
    win_rate: Number(row.win_rate ?? 0),
    pnl: Number(row.pnl ?? 0),
    discipline_score: row.discipline_score != null ? Number(row.discipline_score) : null,
    discipline_grade: row.discipline_grade != null ? String(row.discipline_grade) : null,
    key_lesson: String(row.key_lesson ?? ""),
    chapter_number: Number(row.chapter_number ?? 1),
    is_winning_chapter: Boolean(row.is_winning_chapter),
    max_trades_allowed: Number(row.max_trades_allowed ?? 2),
    summary_payload: (row.summary_payload as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export class WeeklySummariesTableMissingError extends Error {
  constructor() {
    super("Weekly summaries table is missing. Run supabase/038-weekly-chapters.sql in Supabase.")
    this.name = "WeeklySummariesTableMissingError"
  }
}

function isMissingTableError(message: string): boolean {
  return /weekly_summaries|relation .* does not exist|schema cache/i.test(message)
}

export async function listWeeklySummaries(
  supabase: SupabaseClient,
  userId: string,
  accountId: string | null,
  legacyAccountId: string | null,
  limit = 52,
): Promise<WeeklySummaryRecord[]> {
  let query = supabase
    .from("weekly_summaries")
    .select("*")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(limit)

  if (accountId) {
    query = query.or(accountScopeOrFilter(accountId, legacyAccountId))
  }

  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error.message)) throw new WeeklySummariesTableMissingError()
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => normalizeSummary(row as Record<string, unknown>))
}

export async function fetchChapterTrades(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  legacyAccountId: string | null,
): Promise<ChapterTradeRow[]> {
  let query = supabase
    .from("trades")
    .select("trade_date, created_at, pnl, result, emotion, mistake_tags")
    .eq("user_id", userId)
    .order("trade_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(400)

  query = query.or(accountScopeOrFilter(accountId, legacyAccountId))

  const { data, error } = await query
  if (error) {
    if (/account_id|column/i.test(error.message)) {
      const fallback = await supabase
        .from("trades")
        .select("trade_date, created_at, pnl, result, emotion, mistake_tags")
        .eq("user_id", userId)
        .limit(400)
      return (fallback.data ?? []) as ChapterTradeRow[]
    }
    throw new Error(error.message)
  }

  return (data ?? []) as ChapterTradeRow[]
}

export async function fetchChapterPaperTrades(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  legacyAccountId: string | null,
): Promise<PaperTradeRecord[]> {
  try {
    return await listPaperTrades(supabase, userId, accountId, legacyAccountId)
  } catch (error) {
    if (error instanceof PaperTradesTableMissingError) return []
    throw error
  }
}

export async function upsertWeeklySummary(
  supabase: SupabaseClient,
  userId: string,
  accountId: string | null,
  summary: Omit<
    WeeklySummaryRecord,
    "id" | "user_id" | "account_id" | "created_at" | "updated_at"
  > & { id?: string },
): Promise<WeeklySummaryRecord> {
  const now = new Date().toISOString()
  const payload = {
    user_id: userId,
    account_id: accountId,
    week_start: summary.week_start,
    trades_taken: summary.trades_taken,
    wins: summary.wins,
    losses: summary.losses,
    win_rate: summary.win_rate,
    pnl: summary.pnl,
    discipline_score: summary.discipline_score,
    discipline_grade: summary.discipline_grade,
    key_lesson: summary.key_lesson,
    chapter_number: summary.chapter_number,
    is_winning_chapter: summary.is_winning_chapter,
    max_trades_allowed: summary.max_trades_allowed,
    summary_payload: summary.summary_payload,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from("weekly_summaries")
    .upsert(payload, { onConflict: "user_id,account_id,week_start" })
    .select("*")
    .single()

  if (error) {
    if (isMissingTableError(error.message)) throw new WeeklySummariesTableMissingError()
    throw new Error(error.message)
  }

  return normalizeSummary(data as Record<string, unknown>)
}

export async function generateWeeklySummaryForWeek(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  legacyAccountId: string | null,
  weekStart: string,
  trades: ChapterTradeRow[],
  options?: {
    maxTradesPerWeek?: number
    disciplineScore?: number | null
    disciplineGrade?: string | null
    originWeekStart?: string
    persistReview?: boolean
    paperTrades?: PaperTradeRecord[]
  },
): Promise<WeeklySummaryRecord> {
  const account = await getTradingAccount(supabase, userId, accountId)
  const maxTrades = options?.maxTradesPerWeek ?? account?.max_trades_per_week ?? 2
  const originWeekStart =
    options?.originWeekStart ?? resolveOriginWeekStart(trades, account?.created_at ?? null)
  const weekStats = computeWeekTradeStats(trades, weekStart)
  const chapterNumber = computeChapterNumber(originWeekStart, weekStart)
  const disciplineScore = options?.disciplineScore ?? null
  const disciplineGrade =
    options?.disciplineGrade ?? disciplineGradeFromScore(disciplineScore)
  const keyLesson = buildKeyLesson({
    trades,
    weekStart,
    wins: weekStats.wins,
    losses: weekStats.losses,
    pnl: weekStats.pnl,
    disciplineScore,
  })

  const { data: coachRows } = await supabase
    .from("trade_coach_sessions")
    .select("updated_at, created_at, key_insight")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .limit(200)

  const coachSessionsThisWeek = (coachRows ?? []).filter((row) => {
    const raw = String(row.updated_at ?? row.created_at ?? "")
    const date = raw.slice(0, 10)
    return isTradeInWeekStart({ trade_date: date, created_at: raw }, weekStart)
  })
  const keyCoachingInsight =
    coachSessionsThisWeek
      .map((row) => row.key_insight)
      .find((value) => typeof value === "string" && value.trim()) ?? keyLesson

  const paperStats =
    options?.paperTrades != null
      ? computeWeeklyChapterPaperStats(options.paperTrades, weekStart)
      : null

  const summary = await upsertWeeklySummary(supabase, userId, accountId, {
    week_start: weekStart,
    trades_taken: weekStats.tradesTaken,
    wins: weekStats.wins,
    losses: weekStats.losses,
    win_rate: weekStats.winRate,
    pnl: weekStats.pnl,
    discipline_score: disciplineScore,
    discipline_grade: disciplineGrade,
    key_lesson: keyLesson,
    chapter_number: chapterNumber,
    is_winning_chapter: weekStats.pnl > 0,
    max_trades_allowed: maxTrades,
    summary_payload: {
      autoGenerated: true,
      coachSessionsThisWeek: coachSessionsThisWeek.length,
      keyCoachingInsight,
      ...(paperStats && paperStats.total > 0 ? { paper: paperStats } : {}),
    },
  })

  if (options?.persistReview !== false && weekStats.tradesTaken > 0) {
    const currentWeekStart = toWeekStartISO(new Date())
    const weekOffset = Math.round(
      (new Date(`${weekStart}T12:00:00`).getTime() -
        new Date(`${currentWeekStart}T12:00:00`).getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    )
    const { data: settings } = await supabase
      .from("user_settings")
      .select("max_risk_per_trade")
      .eq("user_id", userId)
      .maybeSingle()
    const maxRisk = settings?.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade
    await generateWeeklyReviewForUser(supabase, userId, weekOffset, maxRisk).catch(() => undefined)
  }

  return summary
}

export async function autoClosePastWeeks(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  legacyAccountId: string | null,
  trades: ChapterTradeRow[],
  originWeekStart: string,
  paperTrades: PaperTradeRecord[] = [],
): Promise<void> {
  const currentWeekStart = toWeekStartISO(new Date())
  const existing = await listWeeklySummaries(supabase, userId, accountId, legacyAccountId)

  let week = originWeekStart
  while (week < currentWeekStart) {
    const stats = computeWeekTradeStats(trades, week)
    const paperStats = computeWeeklyChapterPaperStats(paperTrades, week)
    const exists = existing.some((row) => row.week_start === week)
    if ((stats.tradesTaken > 0 || paperStats.total > 0) && !exists) {
      await generateWeeklySummaryForWeek(supabase, userId, accountId, legacyAccountId, week, trades, {
        originWeekStart,
        paperTrades,
      })
    }
    week = getNextWeekStartISO(week)
  }
}

export async function getWeeklyChapterDashboard(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  options?: {
    traderFirstName?: string | null
    disciplineScore?: number | null
    disciplineGrade?: string | null
  },
): Promise<WeeklyChapterDashboard> {
  const legacyAccountId = await resolveLegacyTradeAccountId(supabase, userId)
  const account = await getTradingAccount(supabase, userId, accountId)
  const [trades, paperTrades] = await Promise.all([
    fetchChapterTrades(supabase, userId, accountId, legacyAccountId),
    fetchChapterPaperTrades(supabase, userId, accountId, legacyAccountId),
  ])
  const originWeekStart = resolveOriginWeekStart(trades, account?.created_at ?? null)

  await autoClosePastWeeks(
    supabase,
    userId,
    accountId,
    legacyAccountId,
    trades,
    originWeekStart,
    paperTrades,
  )

  const summaries = await listWeeklySummaries(supabase, userId, accountId, legacyAccountId)

  return buildWeeklyChapterDashboard({
    trades,
    paperTrades,
    summaries,
    originWeekStart,
    maxTradesPerWeek: account?.max_trades_per_week ?? 2,
    traderFirstName: options?.traderFirstName,
    disciplineScore: options?.disciplineScore,
    disciplineGrade: options?.disciplineGrade,
  })
}

export async function resolveWeeklyChapterContext(
  supabase: SupabaseClient,
  userId: string,
  request?: Request,
) {
  const accountId = await resolveActiveAccountId(supabase, userId, request)
  const legacyAccountId = accountId
    ? await resolveLegacyTradeAccountId(supabase, userId)
    : null
  return { accountId, legacyAccountId }
}
