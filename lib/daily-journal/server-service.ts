import type { SupabaseClient } from "@supabase/supabase-js"
import { DAILY_JOURNAL_FIELD_MAX_LENGTH } from "@/lib/daily-journal/constants"
import type { DailyJournalClosePayload, DailyJournalCloseResponse, DailyJournalEntry } from "@/lib/daily-journal/types"

type DailyJournalRow = {
  id: string
  session_date: string
  improve_tomorrow: string | null
  rules_next_session: string | null
  focus_area: string | null
  updated_at: string
}

function isMissingTable(message: string): boolean {
  return /daily_journal_entries|relation .* does not exist|schema cache/i.test(message)
}

function trimField(value: string): string | null {
  const trimmed = value.trim().slice(0, DAILY_JOURNAL_FIELD_MAX_LENGTH)
  return trimmed || null
}

function mapRow(row: DailyJournalRow): DailyJournalEntry {
  return {
    id: row.id,
    sessionDate: row.session_date,
    improveTomorrow: row.improve_tomorrow ?? "",
    rulesNextSession: row.rules_next_session ?? "",
    focusArea: row.focus_area ?? "",
    updatedAt: row.updated_at,
  }
}

export function todaySessionDateISO(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export async function getDailyJournalClose(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  sessionDate = todaySessionDateISO(),
): Promise<DailyJournalCloseResponse> {
  const { data, error } = await supabase
    .from("daily_journal_entries")
    .select("id, session_date, improve_tomorrow, rules_next_session, focus_area, updated_at")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("session_date", sessionDate)
    .maybeSingle()

  if (error) {
    if (isMissingTable(error.message)) {
      return {
        connected: false,
        entry: null,
        setupMessage: "Run supabase/RUN-DAILY-JOURNAL-CLOSE.sql to enable end-of-day journal.",
      }
    }
    throw new Error(error.message)
  }

  return {
    connected: true,
    entry: data ? mapRow(data as DailyJournalRow) : null,
  }
}

export async function saveDailyJournalClose(
  supabase: SupabaseClient,
  userId: string,
  payload: DailyJournalClosePayload,
): Promise<DailyJournalCloseResponse> {
  const sessionDate = payload.sessionDate?.trim() || todaySessionDateISO()
  const row = {
    user_id: userId,
    account_id: payload.accountId,
    session_date: sessionDate,
    improve_tomorrow: trimField(payload.improveTomorrow),
    rules_next_session: trimField(payload.rulesNextSession),
    focus_area: trimField(payload.focusArea),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("daily_journal_entries")
    .upsert(row, { onConflict: "user_id,account_id,session_date" })
    .select("id, session_date, improve_tomorrow, rules_next_session, focus_area, updated_at")
    .single()

  if (error) {
    if (isMissingTable(error.message)) {
      return {
        connected: false,
        entry: null,
        setupMessage: "Run supabase/RUN-DAILY-JOURNAL-CLOSE.sql to enable end-of-day journal.",
      }
    }
    throw new Error(error.message)
  }

  return {
    connected: true,
    entry: mapRow(data as DailyJournalRow),
  }
}
