import type { SupabaseClient } from "@supabase/supabase-js"
import type { LifeContextEntry } from "@/lib/adaptive-cognition/types"

function rowToEntry(row: Record<string, unknown>): LifeContextEntry {
  return {
    date: String(row.log_date ?? row.created_at ?? "").slice(0, 10),
    sleepQuality: row.sleep_quality != null ? Number(row.sleep_quality) : null,
    stress: row.stress != null ? Number(row.stress) : null,
    workFatigue: row.work_fatigue != null ? Number(row.work_fatigue) : null,
    gymConsistency: row.gym_consistency != null ? Number(row.gym_consistency) : null,
    emotionalState: row.emotional_state != null ? Number(row.emotional_state) : null,
    focusLevel: row.focus_level != null ? Number(row.focus_level) : null,
    notes: row.notes != null ? String(row.notes) : null,
  }
}

export async function loadLifeContextHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 14,
): Promise<LifeContextEntry[]> {
  const { data, error } = await supabase
    .from("trader_life_context")
    .select("*")
    .eq("user_id", userId)
    .order("log_date", { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data.map((row) => rowToEntry(row as Record<string, unknown>))
}

export async function upsertLifeContextEntry(
  supabase: SupabaseClient,
  userId: string,
  entry: LifeContextEntry,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("trader_life_context").upsert(
    {
      user_id: userId,
      log_date: entry.date,
      sleep_quality: entry.sleepQuality,
      stress: entry.stress,
      work_fatigue: entry.workFatigue,
      gym_consistency: entry.gymConsistency,
      emotional_state: entry.emotionalState,
      focus_level: entry.focusLevel,
      notes: entry.notes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,log_date" },
  )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function persistAdaptiveInsights(
  supabase: SupabaseClient,
  userId: string,
  insights: Array<{ id: string; message: string; category: string; confidence: number }>,
): Promise<void> {
  if (insights.length === 0) return
  const rows = insights.slice(0, 5).map((i) => ({
    user_id: userId,
    insight_key: i.id,
    message: i.message,
    category: i.category,
    confidence: i.confidence,
    created_at: new Date().toISOString(),
  }))
  await supabase.from("adaptive_insights").insert(rows).then(() => undefined)
}
