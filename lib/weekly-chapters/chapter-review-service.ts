import type { SupabaseClient } from "@supabase/supabase-js"
import { isJournalTrade } from "@/lib/analytics/trade-scope"
import {
  accountScopeOrFilter,
  resolveLegacyTradeAccountId,
} from "@/lib/accounts/server-active-account"
import { getTradingAccount } from "@/lib/accounts/trading-account-service"
import { getSignedPnL } from "@/lib/trade-utils"
import {
  buildKeyLesson,
  computeWeekTradeStats,
} from "@/lib/weekly-chapters/key-lesson"
import {
  computeWeeklyChapterPaperStats,
  formatWeeklyPaperSummaryLine,
  readWeeklySummaryPaperStats,
} from "@/lib/weekly-chapters/paper-stats"
import {
  fetchChapterPaperTrades,
  fetchChapterTrades,
  listWeeklySummaries,
} from "@/lib/weekly-chapters/server-service"
import type {
  ChapterReviewPayload,
  ChapterReviewTrade,
  WeeklySummaryRecord,
} from "@/lib/weekly-chapters/types"
import {
  computeChapterNumber,
  disciplineGradeFromScore,
  formatWeekOfLabel,
  isTradeInWeekStart,
  resolveOriginWeekStart,
  toWeekStartISO,
} from "@/lib/weekly-chapters/week-utils"

const WEEK_START_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isValidWeekStartParam(value: string): boolean {
  return WEEK_START_PATTERN.test(value)
}

type CoachSessionRow = {
  trade_id: string | null
  quality_grade: string | null
  key_insight: string | null
  updated_at: string | null
  created_at: string | null
  planned_context?: { tradingview_setup_grade?: string | null } | null
}

async function fetchCoachSessionsForAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<CoachSessionRow[]> {
  const { data, error } = await supabase
    .from("trade_coach_sessions")
    .select("trade_id, quality_grade, key_insight, updated_at, created_at, planned_context")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .limit(300)

  if (error) {
    if (/trade_coach_sessions|relation .* does not exist|schema cache/i.test(error.message)) {
      return []
    }
    throw new Error(error.message)
  }

  return (data ?? []) as CoachSessionRow[]
}

function coachSessionsInWeek(sessions: CoachSessionRow[], weekStart: string): CoachSessionRow[] {
  return sessions.filter((row) => {
    const raw = String(row.updated_at ?? row.created_at ?? "")
    const date = raw.slice(0, 10)
    return isTradeInWeekStart({ trade_date: date, created_at: raw }, weekStart)
  })
}

function buildEphemeralSummary(input: {
  weekStart: string
  trades: Awaited<ReturnType<typeof fetchChapterTrades>>
  originWeekStart: string
  maxTrades: number
  paperPayload?: Record<string, unknown>
}): WeeklySummaryRecord {
  const weekStats = computeWeekTradeStats(input.trades, input.weekStart)
  const keyLesson = buildKeyLesson({
    trades: input.trades,
    weekStart: input.weekStart,
    wins: weekStats.wins,
    losses: weekStats.losses,
    pnl: weekStats.pnl,
    disciplineScore: null,
  })

  return {
    id: `ephemeral-${input.weekStart}`,
    user_id: "",
    account_id: null,
    week_start: input.weekStart,
    trades_taken: weekStats.tradesTaken,
    wins: weekStats.wins,
    losses: weekStats.losses,
    win_rate: weekStats.winRate,
    pnl: weekStats.pnl,
    discipline_score: null,
    discipline_grade: null,
    key_lesson: keyLesson,
    chapter_number: computeChapterNumber(input.originWeekStart, input.weekStart),
    is_winning_chapter: weekStats.pnl > 0,
    max_trades_allowed: input.maxTrades,
    summary_payload: input.paperPayload ?? {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function mapReviewTrades(
  rows: Array<Record<string, unknown>>,
  weekStart: string,
  coachByTradeId: Map<string, CoachSessionRow>,
): ChapterReviewTrade[] {
  return rows
    .filter((row) =>
      isTradeInWeekStart(
        {
          trade_date: row.trade_date != null ? String(row.trade_date) : null,
          created_at: row.created_at != null ? String(row.created_at) : null,
        },
        weekStart,
      ),
    )
    .map((row) => {
      const id = String(row.id)
      const coach = coachByTradeId.get(id)
      const grade =
        coach?.quality_grade?.trim() ||
        coach?.planned_context?.tradingview_setup_grade?.trim() ||
        null

      return {
        id,
        pair: String(row.pair ?? row.symbol ?? "—"),
        direction: String(row.direction ?? "—"),
        result: String(row.result ?? "—"),
        pnl: getSignedPnL(Number(row.pnl ?? 0), String(row.result ?? "")),
        session: row.session != null ? String(row.session) : null,
        emotion: row.emotion != null ? String(row.emotion) : null,
        entry_price: row.entry_price != null ? Number(row.entry_price) : null,
        stop_loss: row.stop_loss != null ? Number(row.stop_loss) : null,
        take_profit: row.take_profit != null ? Number(row.take_profit) : null,
        screenshot_url: row.screenshot_url != null ? String(row.screenshot_url) : null,
        trade_date: row.trade_date != null ? String(row.trade_date) : null,
        coach_grade: grade,
        coach_insight: coach?.key_insight?.trim() || null,
      }
    })
    .sort((a, b) => {
      const da = a.trade_date ?? ""
      const db = b.trade_date ?? ""
      return db.localeCompare(da)
    })
}

async function fetchChapterReviewTradeRows(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  legacyAccountId: string | null,
): Promise<Array<Record<string, unknown>>> {
  let query = supabase
    .from("trades")
    .select(
      "id, pair, direction, result, pnl, session, emotion, entry_price, stop_loss, take_profit, screenshot_url, trade_date, created_at, import_source",
    )
    .eq("user_id", userId)
    .order("trade_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(400)

  query = query.or(accountScopeOrFilter(accountId, legacyAccountId))

  const { data, error } = await query
  let rows = (data ?? []) as Array<Record<string, unknown>>

  if (error) {
    if (/account_id|column/i.test(error.message)) {
      const fallback = await supabase
        .from("trades")
        .select(
          "id, pair, direction, result, pnl, session, emotion, entry_price, stop_loss, take_profit, screenshot_url, trade_date, created_at, import_source",
        )
        .eq("user_id", userId)
        .limit(400)
      rows = (fallback.data ?? []) as Array<Record<string, unknown>>
    } else {
      throw new Error(error.message)
    }
  }

  return rows.filter((row) =>
    isJournalTrade({ import_source: row.import_source as string | null | undefined }),
  )
}

function resolveNavigation(
  timeline: WeeklySummaryRecord[],
  weekStart: string,
): ChapterReviewPayload["navigation"] {
  const sorted = [...timeline].sort((a, b) => b.week_start.localeCompare(a.week_start))
  const index = sorted.findIndex((row) => row.week_start === weekStart)
  if (index < 0) {
    return { previousWeekStart: null, nextWeekStart: null }
  }
  return {
    previousWeekStart: index < sorted.length - 1 ? sorted[index + 1]!.week_start : null,
    nextWeekStart: index > 0 ? sorted[index - 1]!.week_start : null,
  }
}

function collectCoachInsights(
  summary: WeeklySummaryRecord,
  weekCoachSessions: CoachSessionRow[],
): string[] {
  const insights: string[] = []
  const payloadInsight = summary.summary_payload?.keyCoachingInsight
  if (typeof payloadInsight === "string" && payloadInsight.trim()) {
    insights.push(payloadInsight.trim())
  }

  for (const session of weekCoachSessions) {
    const insight = session.key_insight?.trim()
    if (insight && !insights.includes(insight)) {
      insights.push(insight)
    }
  }

  return insights
}

export async function getChapterReview(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  weekStart: string,
): Promise<ChapterReviewPayload> {
  if (!isValidWeekStartParam(weekStart)) {
    throw new Error("Invalid week")
  }

  const legacyAccountId = await resolveLegacyTradeAccountId(supabase, userId)
  const account = await getTradingAccount(supabase, userId, accountId)
  const maxTrades = account?.max_trades_per_week ?? 2

  const [summaries, chapterTrades, paperTrades, tradeRows, coachSessions] = await Promise.all([
    listWeeklySummaries(supabase, userId, accountId, legacyAccountId),
    fetchChapterTrades(supabase, userId, accountId, legacyAccountId),
    fetchChapterPaperTrades(supabase, userId, accountId, legacyAccountId),
    fetchChapterReviewTradeRows(supabase, userId, accountId, legacyAccountId),
    fetchCoachSessionsForAccount(supabase, userId, accountId),
  ])

  const originWeekStart = resolveOriginWeekStart(chapterTrades, account?.created_at ?? null)
  let summary = summaries.find((row) => row.week_start === weekStart) ?? null

  const paperStats =
    paperTrades.length > 0 ? computeWeeklyChapterPaperStats(paperTrades, weekStart) : null

  if (!summary) {
    const weekStats = computeWeekTradeStats(chapterTrades, weekStart)
    if (weekStats.tradesTaken === 0 && (paperStats?.total ?? 0) === 0) {
      throw new Error(`No chapter data for ${formatWeekOfLabel(weekStart)}`)
    }

    summary = buildEphemeralSummary({
      weekStart,
      trades: chapterTrades,
      originWeekStart,
      maxTrades,
      paperPayload: paperStats && paperStats.total > 0 ? { paper: paperStats } : {},
    })
  }

  const coachByTradeId = new Map<string, CoachSessionRow>()
  for (const session of coachSessions) {
    if (session.trade_id) {
      coachByTradeId.set(String(session.trade_id), session)
    }
  }

  const weekCoachSessions = coachSessionsInWeek(coachSessions, weekStart)
  const trades = mapReviewTrades(tradeRows, weekStart, coachByTradeId)
  const paperLine = formatWeeklyPaperSummaryLine(readWeeklySummaryPaperStats(summary))
  const currentWeekStart = toWeekStartISO(new Date())
  const navigation = resolveNavigation(summaries, weekStart)

  const disciplineScore = summary.discipline_score
  if (disciplineScore != null && !summary.discipline_grade) {
    summary = {
      ...summary,
      discipline_grade: disciplineGradeFromScore(disciplineScore),
    }
  }

  return {
    summary,
    trades,
    coachInsights: collectCoachInsights(summary, weekCoachSessions),
    paperLine,
    carryForwardLesson: summary.key_lesson?.trim() || "Protect process over outcome.",
    isClosed: weekStart < currentWeekStart,
    navigation,
  }
}
