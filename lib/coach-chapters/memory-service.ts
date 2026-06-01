import type { SupabaseClient } from "@supabase/supabase-js"
import type { CoachMemoryRecord, CoachMilestone } from "@/lib/coach-chapters/types"
import type { WeeklySummaryRecord } from "@/lib/weekly-chapters/types"

function normalizeMemory(row: Record<string, unknown>): CoachMemoryRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    account_id: row.account_id != null ? String(row.account_id) : null,
    key_lessons: Array.isArray(row.key_lessons)
      ? row.key_lessons.map(String)
      : [],
    milestones: Array.isArray(row.milestones)
      ? (row.milestones as CoachMilestone[])
      : [],
    last_session_at: row.last_session_at != null ? String(row.last_session_at) : null,
    total_sessions: Number(row.total_sessions ?? 0),
    updated_at: String(row.updated_at),
  }
}

export async function getOrCreateCoachMemory(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<CoachMemoryRecord | null> {
  const { data: existing, error } = await supabase
    .from("coach_memories")
    .select("*")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .maybeSingle()

  if (error && !/coach_memories|does not exist|schema cache/i.test(error.message)) {
    throw new Error(error.message)
  }
  if (existing) return normalizeMemory(existing as Record<string, unknown>)

  const now = new Date().toISOString()
  const { data, error: insertError } = await supabase
    .from("coach_memories")
    .insert({
      user_id: userId,
      account_id: accountId,
      updated_at: now,
    })
    .select("*")
    .single()

  if (insertError) {
    if (/coach_memories|does not exist|schema cache/i.test(insertError.message)) return null
    throw new Error(insertError.message)
  }

  return normalizeMemory(data as Record<string, unknown>)
}

export async function incrementCoachMemorySession(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  keyInsight?: string | null,
): Promise<void> {
  const memory = await getOrCreateCoachMemory(supabase, userId, accountId)
  if (!memory) return

  const lessons = [...memory.key_lessons]
  if (keyInsight?.trim()) {
    lessons.unshift(keyInsight.trim())
  }

  await supabase
    .from("coach_memories")
    .update({
      total_sessions: memory.total_sessions + 1,
      last_session_at: new Date().toISOString(),
      key_lessons: lessons.slice(0, 24),
      updated_at: new Date().toISOString(),
    })
    .eq("id", memory.id)
    .eq("user_id", userId)
}

export function detectNewMilestones(input: {
  memory: CoachMemoryRecord | null
  chapterStreak: number
  recentChapter: WeeklySummaryRecord | null
  closedChapters: WeeklySummaryRecord[]
}): CoachMilestone[] {
  const existing = new Set((input.memory?.milestones ?? []).map((row) => row.id))
  const found: CoachMilestone[] = []
  const now = new Date().toISOString()

  const winningWeeks = input.closedChapters.filter((row) => row.is_winning_chapter)
  if (winningWeeks.length === 1 && !existing.has("first_winning_week")) {
    const chapter = winningWeeks[0]
    found.push({
      id: "first_winning_week",
      label: "First winning week",
      message: `You did it. Chapter ${chapter.chapter_number} — your first winning week. Remember this feeling. This is what the process produces.`,
      achieved_at: now,
    })
  }

  if (input.chapterStreak >= 5 && !existing.has("chapter_streak_5")) {
    found.push({
      id: "chapter_streak_5",
      label: "5 chapter streak",
      message:
        "5 winning chapters in a row. You're not lucky — you're consistent. That's the hardest thing in trading.",
      achieved_at: now,
    })
  }

  if (
    input.recentChapter?.discipline_grade === "A+" &&
    input.recentChapter.is_winning_chapter &&
    !existing.has("first_aplus_chapter")
  ) {
    found.push({
      id: "first_aplus_chapter",
      label: "A+ chapter",
      message:
        "That was textbook execution. Every filter. Perfect discipline. That's your standard now.",
      achieved_at: now,
    })
  }

  return found
}

export async function persistCoachMilestones(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  milestones: CoachMilestone[],
): Promise<void> {
  if (milestones.length === 0) return
  const memory = await getOrCreateCoachMemory(supabase, userId, accountId)
  if (!memory) return

  const merged = [...milestones, ...memory.milestones]
  const byId = new Map<string, CoachMilestone>()
  for (const row of merged) byId.set(row.id, row)

  await supabase
    .from("coach_memories")
    .update({
      milestones: Array.from(byId.values()).slice(0, 20),
      updated_at: new Date().toISOString(),
    })
    .eq("id", memory.id)
    .eq("user_id", userId)
}
