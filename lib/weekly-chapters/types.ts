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

export type WeeklyChapterDashboard = {
  chapterNumber: number
  weekStart: string
  weekLabel: string
  title: string
  subtitle: string
  chapterStreak: number
  thisWeek: WeeklyChapterWeekStats
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
