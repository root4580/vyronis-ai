import type {
  ChapterTradeRow,
  WeeklyChapterDashboard,
  WeeklySummaryRecord,
} from "@/lib/weekly-chapters/types"
import {
  buildKeyLesson,
  computeChapterStreak,
  computeWeekTradeStats,
  countWeekLosses,
  hasWinInWeek,
} from "@/lib/weekly-chapters/key-lesson"
import { computeWeeklyChapterPaperStats } from "@/lib/weekly-chapters/paper-stats"
import type { PaperTradeRecord } from "@/lib/paper-trades/types"
import {
  computeChapterNumber,
  formatChapterTitle,
  formatWeekOfLabel,
  getPreviousWeekStartISO,
  isMondayMorning,
  isSundayEvening,
  toWeekStartISO,
} from "@/lib/weekly-chapters/week-utils"

export function buildWeeklyChapterDashboard(input: {
  trades: ChapterTradeRow[]
  paperTrades?: PaperTradeRecord[]
  summaries: WeeklySummaryRecord[]
  originWeekStart: string
  currentWeekStart?: string
  maxTradesPerWeek: number
  traderFirstName?: string | null
  disciplineScore?: number | null
  disciplineGrade?: string | null
  referenceDate?: Date
}): WeeklyChapterDashboard {
  const now = input.referenceDate ?? new Date()
  const weekStart = input.currentWeekStart ?? toWeekStartISO(now)
  const chapterNumber = computeChapterNumber(input.originWeekStart, weekStart)
  const currentWeekSummary = input.summaries.find((summary) => summary.week_start === weekStart)
  const disciplineScore =
    input.disciplineScore ?? currentWeekSummary?.discipline_score ?? null
  const disciplineGrade =
    input.disciplineGrade ?? currentWeekSummary?.discipline_grade ?? null

  const weekStats = computeWeekTradeStats(input.trades, weekStart)
  const thisWeekPaper =
    input.paperTrades != null
      ? computeWeeklyChapterPaperStats(input.paperTrades, weekStart)
      : null
  const previousWeekStart = getPreviousWeekStartISO(weekStart)
  const previousChapter =
    input.summaries.find((summary) => summary.week_start === previousWeekStart) ?? null

  const closedSummaries = input.summaries.filter((summary) => summary.week_start !== weekStart)
  const chapterStreak = computeChapterStreak(closedSummaries)

  const hasWinThisWeek = hasWinInWeek(input.trades, weekStart)
  const lastWeekLosses = countWeekLosses(input.trades, previousWeekStart)

  let carryForwardMessage: string | null = null
  if (previousChapter && previousChapter.pnl < 0) {
    carryForwardMessage = "Last chapter ended tough — use it as fuel, not baggage."
  } else if (previousChapter && previousChapter.win_rate === 0 && previousChapter.trades_taken > 0) {
    carryForwardMessage = "Last chapter ended tough — use it as fuel, not baggage."
  }

  let mondayMessage: string | null = null
  if (isMondayMorning(now)) {
    const name = input.traderFirstName?.trim() || "Trader"
    mondayMessage = `Good morning ${name}. Chapter ${chapterNumber} begins today. Your edge is intact. The market is ready. Are you?`
  }

  let toughWeekReminder: string | null = null
  if (lastWeekLosses >= 3 && !hasWinThisWeek) {
    toughWeekReminder =
      "Last week was tough. Take your first trade extra carefully. Run Coach before entry this week."
  }

  const showSundayComplete =
    isSundayEvening(now) &&
    (weekStats.tradesTaken > 0 || (thisWeekPaper?.total ?? 0) > 0)
  const sundayCompletePreview = showSundayComplete
    ? buildPreviewSummary({
        weekStart,
        chapterNumber,
        weekStats,
        maxTrades: input.maxTradesPerWeek,
        disciplineScore: input.disciplineScore ?? null,
        disciplineGrade: input.disciplineGrade ?? null,
        trades: input.trades,
        paperStats: thisWeekPaper,
      })
    : null

  return {
    chapterNumber,
    weekStart,
    weekLabel: formatWeekOfLabel(weekStart),
    title: formatChapterTitle(chapterNumber, weekStart),
    subtitle: "Your fresh start. Your story continues.",
    chapterStreak,
    thisWeek: {
      tradesTaken: weekStats.tradesTaken,
      maxTrades: input.maxTradesPerWeek,
      wins: weekStats.wins,
      losses: weekStats.losses,
      winRate: weekStats.winRate,
      pnl: weekStats.pnl,
      disciplineScore,
      disciplineGrade,
    },
    thisWeekPaper: thisWeekPaper && thisWeekPaper.total > 0 ? thisWeekPaper : null,
    previousChapter,
    carryForwardMessage,
    mondayMessage,
    toughWeekReminder: hasWinThisWeek ? null : toughWeekReminder,
    hasWinThisWeek,
    showSundayComplete,
    sundayCompletePreview,
    timeline: [...input.summaries].sort((a, b) => b.week_start.localeCompare(a.week_start)),
  }
}

function buildPreviewSummary(input: {
  weekStart: string
  chapterNumber: number
  weekStats: ReturnType<typeof computeWeekTradeStats>
  maxTrades: number
  disciplineScore: number | null
  disciplineGrade: string | null
  trades: ChapterTradeRow[]
  paperStats: ReturnType<typeof computeWeeklyChapterPaperStats> | null
}): WeeklySummaryRecord {
  const keyLesson = buildKeyLesson({
    trades: input.trades,
    weekStart: input.weekStart,
    wins: input.weekStats.wins,
    losses: input.weekStats.losses,
    pnl: input.weekStats.pnl,
    disciplineScore: input.disciplineScore,
  })

  return {
    id: "preview",
    user_id: "",
    account_id: null,
    week_start: input.weekStart,
    trades_taken: input.weekStats.tradesTaken,
    wins: input.weekStats.wins,
    losses: input.weekStats.losses,
    win_rate: input.weekStats.winRate,
    pnl: input.weekStats.pnl,
    discipline_score: input.disciplineScore,
    discipline_grade: input.disciplineGrade,
    key_lesson: keyLesson,
    chapter_number: input.chapterNumber,
    is_winning_chapter: input.weekStats.pnl > 0,
    max_trades_allowed: input.maxTrades,
    summary_payload:
      input.paperStats && input.paperStats.total > 0 ? { paper: input.paperStats } : {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function shouldAutoCloseWeek(weekStart: string, now = new Date()): boolean {
  const currentWeekStart = toWeekStartISO(now)
  if (weekStart >= currentWeekStart) return false
  return true
}
