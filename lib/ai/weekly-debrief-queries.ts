import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  WeeklyDebriefCoachSession,
  WeeklyDebriefFeedback,
  WeeklyDebriefTrade,
} from "@/lib/ai/weekly-debrief-types"
import { fetchAllRowsPaginated } from "@/lib/trades/fetch-all-paginated"

export function isMissingWeeklyDataTableError(
  error: { message?: string; code?: string } | null,
): boolean {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|schema cache/i.test(error.message || "")
  )
}

export function isMissingColumnError(
  error: { message?: string; code?: string } | null,
): boolean {
  if (!error) return false
  return (
    error.code === "42703" ||
    /column .* does not exist|Could not find the .* column/i.test(error.message || "")
  )
}

export async function loadWeeklyDebriefTrades(
  supabase: SupabaseClient,
  userId: string,
): Promise<WeeklyDebriefTrade[]> {
  const extendedSelect =
    "id, pair, direction, result, pnl, emotion, emotion_after, setup, strategy_name, session, risk_percent, rule_followed, mistake_tags, confirmation_signal, trade_date, created_at, screenshot_url"
  const basicSelect =
    "id, pair, direction, result, pnl, emotion, setup, strategy_name, session, trade_date, created_at"

  const extended = await fetchAllRowsPaginated<WeeklyDebriefTrade>((from, to) =>
    supabase
      .from("trades")
      .select(extendedSelect)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to),
  )

  if (!extended.error) {
    return extended.rows
  }

  if (!isMissingColumnError(extended.error)) {
    throw new Error(extended.error.message)
  }

  const fallback = await fetchAllRowsPaginated<WeeklyDebriefTrade>((from, to) =>
    supabase
      .from("trades")
      .select(basicSelect)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to) as unknown as PromiseLike<{
      data: WeeklyDebriefTrade[] | null
      error: { message: string; code?: string } | null
    }>,
  )

  if (fallback.error) throw new Error(fallback.error.message)
  return fallback.rows
}

export async function loadWeeklyDebriefFeedback(
  supabase: SupabaseClient,
  userId: string,
): Promise<WeeklyDebriefFeedback[]> {
  const { data, error } = await supabase
    .from("trade_coach_feedback")
    .select("trade_id, discipline_score, planned_vs_actual")
    .eq("user_id", userId)

  if (error) {
    if (isMissingWeeklyDataTableError(error)) return []
    throw new Error(error.message)
  }

  return (data || []).map((row) => ({
    trade_id: String(row.trade_id),
    discipline_score: row.discipline_score,
    planned_vs_actual: (row.planned_vs_actual ||
      []) as WeeklyDebriefFeedback["planned_vs_actual"],
  }))
}

export async function loadWeeklyDebriefCoachSessions(
  supabase: SupabaseClient,
  userId: string,
): Promise<WeeklyDebriefCoachSession[]> {
  const extendedSelect =
    "id, trade_id, quality_score, quality_grade, recommendation, confidence_score, updated_at"
  const basicSelect = "id, trade_id, updated_at"

  const extendedResult = await supabase
    .from("trade_coach_sessions")
    .select(extendedSelect)
    .eq("user_id", userId)
    .not("trade_id", "is", null)

  let rows: Record<string, unknown>[] | null = extendedResult.data as Record<string, unknown>[] | null

  if (extendedResult.error) {
    if (isMissingWeeklyDataTableError(extendedResult.error)) return []

    if (!isMissingColumnError(extendedResult.error)) {
      throw new Error(extendedResult.error.message)
    }

    const fallback = await supabase
      .from("trade_coach_sessions")
      .select(basicSelect)
      .eq("user_id", userId)
      .not("trade_id", "is", null)

    if (fallback.error) {
      if (isMissingWeeklyDataTableError(fallback.error)) return []
      throw new Error(fallback.error.message)
    }

    rows = fallback.data as Record<string, unknown>[] | null
  }

  return (rows || []).map((row) => ({
    id: String(row.id),
    trade_id: row.trade_id ? String(row.trade_id) : null,
    quality_score: (row.quality_score as number | null | undefined) ?? null,
    quality_grade: (row.quality_grade as WeeklyDebriefCoachSession["quality_grade"]) ?? null,
    recommendation: (row.recommendation as WeeklyDebriefCoachSession["recommendation"]) ?? null,
    confidence_score: (row.confidence_score as number | null | undefined) ?? null,
    updated_at: row.updated_at as string,
  }))
}
