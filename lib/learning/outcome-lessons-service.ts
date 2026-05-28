import type { SupabaseClient } from "@supabase/supabase-js"
import type { OutcomeLessonRecord } from "@/lib/learning/outcome-learning-engine"
import { isMissingLearningTableError } from "@/lib/learning/server-service"

export async function loadRecentOutcomeLessons(
  supabase: SupabaseClient,
  userId: string,
  limit = 8,
): Promise<OutcomeLessonRecord[]> {
  const { data, error } = await supabase
    .from("outcome_lessons")
    .select(
      "trade_id, pair, result, planned_summary, execution_summary, emotion, vyronis_verdict_at_plan, vyronis_was_right, override_reason, lesson, natural_reference, category",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingLearningTableError(error)) return []
    throw new Error(error.message)
  }

  return (data || []).map((row) => ({
    tradeId: String(row.trade_id),
    pair: String(row.pair || ""),
    result: String(row.result || ""),
    plannedSummary: String(row.planned_summary || ""),
    executionSummary: String(row.execution_summary || ""),
    emotion: row.emotion ? String(row.emotion) : null,
    vyronisVerdictAtPlan: row.vyronis_verdict_at_plan as OutcomeLessonRecord["vyronisVerdictAtPlan"],
    vyronisWasRight:
      row.vyronis_was_right === null || row.vyronis_was_right === undefined
        ? null
        : Boolean(row.vyronis_was_right),
    overrideReason: row.override_reason ? String(row.override_reason) : null,
    lesson: String(row.lesson || ""),
    naturalReference: String(row.natural_reference || row.lesson || ""),
    category: String(row.category || "execution"),
  }))
}

export async function persistOutcomeLesson(
  supabase: SupabaseClient,
  userId: string,
  lesson: OutcomeLessonRecord,
): Promise<void> {
  const { error } = await supabase.from("outcome_lessons").upsert(
    {
      user_id: userId,
      trade_id: lesson.tradeId,
      pair: lesson.pair,
      result: lesson.result,
      planned_summary: lesson.plannedSummary,
      execution_summary: lesson.executionSummary,
      emotion: lesson.emotion,
      vyronis_verdict_at_plan: lesson.vyronisVerdictAtPlan,
      vyronis_was_right: lesson.vyronisWasRight,
      override_reason: lesson.overrideReason,
      lesson: lesson.lesson,
      natural_reference: lesson.naturalReference,
      category: lesson.category,
      payload: {},
    },
    { onConflict: "user_id,trade_id" },
  )

  if (error && !isMissingLearningTableError(error)) {
    throw new Error(error.message)
  }
}
