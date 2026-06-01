import type { WeeklySummaryRecord } from "@/lib/weekly-chapters/types"

export type CoachMilestone = {
  id: string
  label: string
  message: string
  achieved_at: string
}

export type CoachMemoryRecord = {
  id: string
  user_id: string
  account_id: string | null
  key_lessons: string[]
  milestones: CoachMilestone[]
  last_session_at: string | null
  total_sessions: number
  updated_at: string
}

export type CoachChapterContext = {
  traderFirstName: string
  currentChapterNumber: number
  recentChapters: WeeklySummaryRecord[]
  chapterStreak: number
  coachSessionsThisWeek: number
  openingMessage: string
  preTradeFraming: string
  weeklyCoachReview: string | null
  newMilestones: CoachMilestone[]
  memory: CoachMemoryRecord | null
}

export type CoachGradeBand = "A+" | "A" | "B" | "C" | "D" | "low"
