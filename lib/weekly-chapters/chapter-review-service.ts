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
  filterPaperTradesForWeek,
  formatWeeklyPaperSummaryLine,
  readWeeklySummaryPaperStats,
} from "@/lib/weekly-chapters/paper-stats"
import { detectChapterReviewPatterns } from "@/lib/weekly-chapters/chapter-patterns"
import { buildChapterEmotionSummary } from "@/lib/weekly-chapters/chapter-emotion-scores"
import { generateChapterReviewAiNarrative } from "@/lib/weekly-chapters/chapter-review-ai"
import {
  mergeChapterReviewAiCache,
  readChapterReviewAiCache,
} from "@/lib/weekly-chapters/chapter-review-cache"
import { buildChapterTradeReviewNotes } from "@/lib/weekly-chapters/trade-review-notes"
import type { PaperTradeRecord } from "@/lib/paper-trades/types"
import {
  fetchChapterPaperTrades,
  fetchChapterTrades,
  listWeeklySummaries,
  upsertWeeklySummary,
} from "@/lib/weekly-chapters/server-service"
import type {
  ChapterReviewPaperTrade,
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
  id: string
  trade_id: string | null
  quality_grade: string | null
  key_insight: string | null
  chart_url: string | null
  screenshot_url: string | null
  warnings: string[] | null
  strengths: string[] | null
  updated_at: string | null
  created_at: string | null
  planned_context?: {
    tradingview_setup_grade?: string | null
    coach_analysis?: { tradeQuality?: { grade?: string | null } } | null
  } | null
}

async function fetchCoachSessionsForAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<CoachSessionRow[]> {
  const { data, error } = await supabase
    .from("trade_coach_sessions")
    .select(
      "id, trade_id, quality_grade, key_insight, chart_url, screenshot_url, warnings, strengths, updated_at, created_at, planned_context",
    )
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
        coach?.planned_context?.coach_analysis?.tradeQuality?.grade?.trim() ||
        coach?.planned_context?.tradingview_setup_grade?.trim() ||
        null

      const screenshotUrl = row.screenshot_url != null ? String(row.screenshot_url) : null
      const chartUrl =
        screenshotUrl || coach?.chart_url?.trim() || coach?.screenshot_url?.trim() || null

      const reviewNotes = buildChapterTradeReviewNotes({
        result: String(row.result ?? "—"),
        pnl: getSignedPnL(Number(row.pnl ?? 0), String(row.result ?? "")),
        emotion: row.emotion != null ? String(row.emotion) : null,
        rule_followed: row.rule_followed === null || row.rule_followed === undefined
          ? null
          : Boolean(row.rule_followed),
        mistake_tags: row.mistake_tags != null ? String(row.mistake_tags) : null,
        coach_grade: grade,
        coach_insight: coach?.key_insight?.trim() || null,
        coach_strengths: coach?.strengths ?? [],
        coach_warnings: coach?.warnings ?? [],
      })

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
        screenshot_url: screenshotUrl,
        chart_url: chartUrl,
        trade_date: row.trade_date != null ? String(row.trade_date) : null,
        rule_followed:
          row.rule_followed === null || row.rule_followed === undefined
            ? null
            : Boolean(row.rule_followed),
        mistake_tags: row.mistake_tags != null ? String(row.mistake_tags) : null,
        coach_grade: grade,
        coach_insight: coach?.key_insight?.trim() || null,
        coach_session_id: coach?.id ?? null,
        what_went_right: reviewNotes.whatWentRight,
        what_went_wrong: reviewNotes.whatWentWrong,
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
      "id, pair, direction, result, pnl, session, emotion, entry_price, stop_loss, take_profit, screenshot_url, trade_date, created_at, import_source, rule_followed, mistake_tags",
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
          "id, pair, direction, result, pnl, session, emotion, entry_price, stop_loss, take_profit, screenshot_url, trade_date, created_at, import_source, rule_followed, mistake_tags",
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

async function loadDisciplineScoresByTradeId(
  supabase: SupabaseClient,
  userId: string,
  tradeIds: string[],
): Promise<Map<string, number>> {
  if (tradeIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from("trade_coach_feedback")
    .select("trade_id, discipline_score")
    .eq("user_id", userId)
    .in("trade_id", tradeIds)

  if (error) {
    if (/trade_coach_feedback|relation .* does not exist|schema cache/i.test(error.message)) {
      return new Map()
    }
    throw new Error(error.message)
  }

  const map = new Map<string, number>()
  for (const row of data ?? []) {
    if (row.trade_id != null && row.discipline_score != null) {
      map.set(String(row.trade_id), Number(row.discipline_score))
    }
  }
  return map
}

function mapChapterReviewPaperTrades(
  paperTrades: PaperTradeRecord[],
  weekStart: string,
): ChapterReviewPaperTrade[] {
  return filterPaperTradesForWeek(paperTrades, weekStart)
    .map((trade) => ({
      id: trade.id,
      symbol: trade.symbol,
      direction: trade.direction,
      result: trade.result,
      pnl: trade.pnl,
      setup_grade: trade.setup_grade,
      chart_image_url: trade.chart_image_url,
      coach_feedback: trade.coach_feedback,
      source: trade.source,
    }))
    .sort((a, b) => b.id.localeCompare(a.id))
}

function isPersistedWeeklySummary(summary: WeeklySummaryRecord): boolean {
  return !summary.id.startsWith("ephemeral-")
}

async function resolveChapterReviewAiNarrative(input: {
  supabase: SupabaseClient
  userId: string
  accountId: string
  summary: WeeklySummaryRecord
  isClosed: boolean
  patterns: ChapterReviewPayload["patterns"]
  trades: ChapterReviewTrade[]
  paperLine: string | null
  paperTrades: ChapterReviewPaperTrade[]
  emotionSummary: ChapterReviewPayload["emotionSummary"]
  coachInsights: string[]
  carryForwardLesson: string
}): Promise<{
  summary: WeeklySummaryRecord
  aiNarrative: string | null
  aiProvider: string | null
}> {
  const cached = readChapterReviewAiCache(input.summary.summary_payload)
  if (cached && input.isClosed) {
    return {
      summary: input.summary,
      aiNarrative: cached.narrative,
      aiProvider: cached.provider,
    }
  }

  const { narrative, provider } = await generateChapterReviewAiNarrative({
    summary: input.summary,
    patterns: input.patterns,
    trades: input.trades,
    paperLine: input.paperLine,
    paperTrades: input.paperTrades,
    emotionSummary: input.emotionSummary,
    coachInsights: input.coachInsights,
    carryForwardLesson: input.carryForwardLesson,
  })

  if (
    !input.isClosed ||
    !narrative?.trim() ||
    !provider ||
    !isPersistedWeeklySummary(input.summary)
  ) {
    return {
      summary: input.summary,
      aiNarrative: narrative,
      aiProvider: provider,
    }
  }

  try {
    const updatedSummary = await upsertWeeklySummary(input.supabase, input.userId, input.accountId, {
      week_start: input.summary.week_start,
      trades_taken: input.summary.trades_taken,
      wins: input.summary.wins,
      losses: input.summary.losses,
      win_rate: input.summary.win_rate,
      pnl: input.summary.pnl,
      discipline_score: input.summary.discipline_score,
      discipline_grade: input.summary.discipline_grade,
      key_lesson: input.summary.key_lesson,
      chapter_number: input.summary.chapter_number,
      is_winning_chapter: input.summary.is_winning_chapter,
      max_trades_allowed: input.summary.max_trades_allowed,
      summary_payload: mergeChapterReviewAiCache(input.summary.summary_payload, {
        narrative: narrative.trim(),
        provider,
        generatedAt: new Date().toISOString(),
      }),
    })

    return {
      summary: updatedSummary,
      aiNarrative: narrative.trim(),
      aiProvider: provider,
    }
  } catch {
    return {
      summary: input.summary,
      aiNarrative: narrative,
      aiProvider: provider,
    }
  }
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
  const patterns = detectChapterReviewPatterns(trades)
  const paperTradesForWeek = mapChapterReviewPaperTrades(paperTrades, weekStart)
  const disciplineByTradeId = await loadDisciplineScoresByTradeId(
    supabase,
    userId,
    trades.map((trade) => trade.id),
  )
  const emotionSummary = buildChapterEmotionSummary({
    trades,
    disciplineByTradeId,
    summaryDisciplineScore: summary.discipline_score,
  })
  const coachInsights = collectCoachInsights(summary, weekCoachSessions)
  const carryForwardLesson = summary.key_lesson?.trim() || "Protect process over outcome."
  const emotionTimeline = trades
    .filter((trade) => Boolean(trade.emotion?.trim()))
    .map((trade) => ({
      pair: trade.pair,
      emotion: trade.emotion!.trim(),
      result: trade.result,
      trade_date: trade.trade_date,
    }))
  const paperLine = formatWeeklyPaperSummaryLine(readWeeklySummaryPaperStats(summary))
  const currentWeekStart = toWeekStartISO(new Date())
  const isClosed = weekStart < currentWeekStart
  const navigation = resolveNavigation(summaries, weekStart)

  const aiResult = await resolveChapterReviewAiNarrative({
    supabase,
    userId,
    accountId,
    summary,
    isClosed,
    patterns,
    trades,
    paperLine,
    paperTrades: paperTradesForWeek,
    emotionSummary,
    coachInsights,
    carryForwardLesson,
  })
  summary = aiResult.summary
  const aiNarrative = aiResult.aiNarrative
  const aiProvider = aiResult.aiProvider

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
    coachInsights,
    paperLine,
    paperTrades: paperTradesForWeek,
    carryForwardLesson,
    patterns,
    aiNarrative,
    aiProvider,
    emotionSummary,
    emotionTimeline,
    isClosed,
    navigation,
  }
}
