import type { SupabaseClient } from "@supabase/supabase-js"
import { SESSION_MOOD_OPTIONS } from "@/lib/coach/session-mood-check-in"

function todayDateISO(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function isMissingMoodTable(message: string): boolean {
  return /coach_daily_mood_checkins|relation .* does not exist|schema cache/i.test(message)
}

const VALID_MOODS = new Set<string>(SESSION_MOOD_OPTIONS)

export function normalizeCoachSessionMood(mood: string | null | undefined): string | null {
  const trimmed = mood?.trim()
  if (!trimmed) return null
  const match = SESSION_MOOD_OPTIONS.find((option) => option.toLowerCase() === trimmed.toLowerCase())
  return match ?? null
}

export async function getTodayCoachSessionMood(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const sessionDate = todayDateISO()
  const { data, error } = await supabase
    .from("coach_daily_mood_checkins")
    .select("mood")
    .eq("user_id", userId)
    .eq("session_date", sessionDate)
    .maybeSingle()

  if (error) {
    if (isMissingMoodTable(error.message)) return null
    throw new Error(error.message)
  }

  return normalizeCoachSessionMood(data?.mood != null ? String(data.mood) : null)
}

export async function saveTodayCoachSessionMood(
  supabase: SupabaseClient,
  userId: string,
  mood: string,
): Promise<string> {
  const normalized = normalizeCoachSessionMood(mood)
  if (!normalized || !VALID_MOODS.has(normalized)) {
    throw new Error("Invalid mood")
  }

  const sessionDate = todayDateISO()
  const { error } = await supabase.from("coach_daily_mood_checkins").upsert(
    {
      user_id: userId,
      session_date: sessionDate,
      mood: normalized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,session_date" },
  )

  if (error) {
    if (isMissingMoodTable(error.message)) return normalized
    throw new Error(error.message)
  }

  return normalized
}
