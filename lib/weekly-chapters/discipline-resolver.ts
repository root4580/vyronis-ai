import type { WeeklySummaryRecord } from "@/lib/weekly-chapters/types"
import { disciplineGradeFromScore } from "@/lib/weekly-chapters/week-utils"

export function resolveCurrentWeekDiscipline(
  summaries: WeeklySummaryRecord[],
  weekStart: string,
): { score: number | null; grade: string | null } {
  const summary = summaries.find((row) => row.week_start === weekStart)
  const score = summary?.discipline_score ?? null
  const grade =
    summary?.discipline_grade ??
    (score != null ? disciplineGradeFromScore(score) : null)
  return { score, grade }
}
