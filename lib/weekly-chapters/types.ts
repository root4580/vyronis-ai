export type WeeklySummaryRecord = {
  id: string
  user_id: string
  account_id: string | null
  week_start: string
  trades_taken: number
  wins: number
  losses: number
  win_rate: number
  pnl: number
  discipline_score: number | null
  discipline_grade: string | null
  key_lesson: string
  chapter_number: number
  is_winning_chapter: boolean
  max_trades_allowed: number
  summary_payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type WeeklyChapterWeekStats = {
  tradesTaken: number
  maxTrades: number
  wins: number
  losses: number
  winRate: number
  pnl: number
  disciplineScore: number | null
  disciplineGrade: string | null
}

/** Practice Room snapshot for a trading week (stored in summary_payload.paper). */
export type WeeklyChapterPaperStats = {
  total: number
  closed: number
  pending: number
  wins: number
  losses: number
  winRate: number
  totalPnL: number
  winStreak: number
  readyForLive: boolean
  coachGraded: number
  warRoomCount: number
}

export type WeeklyChapterDashboard = {
  chapterNumber: number
  weekStart: string
  weekLabel: string
  title: string
  subtitle: string
  chapterStreak: number
  thisWeek: WeeklyChapterWeekStats
  thisWeekPaper: WeeklyChapterPaperStats | null
  previousChapter: WeeklySummaryRecord | null
  carryForwardMessage: string | null
  mondayMessage: string | null
  toughWeekReminder: string | null
  hasWinThisWeek: boolean
  showSundayComplete: boolean
  sundayCompletePreview: WeeklySummaryRecord | null
  timeline: WeeklySummaryRecord[]
  migrationPending?: boolean
}

export type ChapterTradeRow = {
  trade_date: string | null
  created_at: string | null
  pnl: number | null
  result: string | null
  emotion?: string | null
  mistake_tags?: string | null
}

export type ChapterReviewTrade = {
  id: string
  pair: string
  direction: string
  result: string
  pnl: number
  session: string | null
  emotion: string | null
  entry_price: number | null
  stop_loss: number | null
  take_profit: number | null
  screenshot_url: string | null
  trade_date: string | null
  coach_grade: string | null
  coach_insight: string | null
}

export type ChapterReviewPayload = {
  summary: WeeklySummaryRecord
  trades: ChapterReviewTrade[]
  coachInsights: string[]
  paperLine: string | null
  carryForwardLesson: string
  isClosed: boolean
  navigation: {
    previousWeekStart: string | null
    nextWeekStart: string | null
  }
}
