import type { AiReviewRecord } from "@/lib/learning/types"
import type { WeeklyReviewRecord, WeeklyReviewReport } from "@/lib/weekly-review/types"
import { weeklyReviewRowToReport } from "@/lib/weekly-review/engine"

export function weeklyReviewReportToAiReviewRecord(report: WeeklyReviewReport): AiReviewRecord {
  return {
    review_type: "weekly",
    week_start: report.weekStart,
    week_end: report.weekEnd,
    summary: report.headline || "",
    recurring_mistakes: report.recurringMistakes,
    emotional_trends: report.emotionalPatterns.map((row) => ({
      emotion: row.emotion,
      count: row.count,
      trend: "stable",
    })),
    discipline_score: report.scores.discipline,
    most_profitable_setup: report.bestSetupTypes[0] ?? null,
    advice: report.improvementPlan,
    payload: report.debrief ?? report,
  }
}

export function weeklyReviewRowToAiReviewRecord(row: WeeklyReviewRecord): AiReviewRecord {
  const report = weeklyReviewRowToReport(row)
  return {
    id: row.id,
    ...weeklyReviewReportToAiReviewRecord(report),
  }
}
