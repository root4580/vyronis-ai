import type { SupabaseClient } from "@supabase/supabase-js"
import type { CommandCenterMessageRecord } from "@/lib/command-center/types"
import {
  CommandCenterTableMissingError,
  isMissingCommandCenterTableError,
} from "@/lib/command-center/errors"

function isMissingStatusColumn(error: { code?: string; message?: string }): boolean {
  const msg = String(error.message || "").toLowerCase()
  return msg.includes("status") && (msg.includes("column") || msg.includes("schema"))
}

function sessionTitleFromMessages(messages: CommandCenterMessageRecord[]): string {
  const firstUser = messages.find((m) => m.role === "user")
  if (firstUser?.content.trim()) {
    const text = firstUser.content.replace(/^📷\s*/, "").trim()
    return text.length > 48 ? `${text.slice(0, 45)}…` : text
  }
  const analysis = messages.find((m) => m.message_type === "analysis" && m.role === "assistant")
  if (analysis?.content.trim()) {
    const line = analysis.content.split("\n")[0].trim()
    return line.length > 48 ? `${line.slice(0, 45)}…` : line
  }
  const date = new Date().toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
  return `Session · ${date}`
}

function hasSavableConversation(messages: CommandCenterMessageRecord[]): boolean {
  return messages.some(
    (m) =>
      m.role === "user" ||
      (m.role === "assistant" && (m.message_type === "analysis" || m.message_type === "text")),
  )
}

export type CompanionSessionSummary = {
  id: string
  title: string
  updatedAt: string
  preview: string
  messageCount: number
}

export async function getActiveCompanionThreadId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("command_center_threads")
    .select("id")
    .eq("user_id", userId)
    .eq("focus_type", "companion")
    .eq("status", "active")
    .maybeSingle()

  if (error) {
    if (isMissingCommandCenterTableError(error)) throw new CommandCenterTableMissingError()
    if (isMissingStatusColumn(error)) {
      const { data: legacy } = await supabase
        .from("command_center_threads")
        .select("id")
        .eq("user_id", userId)
        .eq("focus_type", "companion")
        .maybeSingle()
      return legacy?.id ? String(legacy.id) : null
    }
    throw new Error(error.message)
  }
  return data?.id ? String(data.id) : null
}

export async function createActiveCompanionThread(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("command_center_threads")
    .insert({
      user_id: userId,
      focus_type: "companion",
      title: "Vyronis Companion",
      status: "active",
    })
    .select("id")
    .single()

  if (error) {
    if (isMissingCommandCenterTableError(error)) throw new CommandCenterTableMissingError()
    if (isMissingStatusColumn(error)) {
      const { data: legacy, error: legacyErr } = await supabase
        .from("command_center_threads")
        .insert({ user_id: userId, focus_type: "companion", title: "Vyronis Companion" })
        .select("id")
        .single()
      if (legacyErr) throw new Error(legacyErr.message)
      return String(legacy!.id)
    }
    throw new Error(error.message)
  }
  return String(data.id)
}

export async function archiveActiveCompanionSession(
  supabase: SupabaseClient,
  userId: string,
  listMessages: (
    supabase: SupabaseClient,
    userId: string,
    threadId: string,
    limit?: number,
  ) => Promise<CommandCenterMessageRecord[]>,
): Promise<{ archived: boolean; sessionId?: string; skipped?: boolean }> {
  const activeId = await getActiveCompanionThreadId(supabase, userId)
  if (!activeId) return { archived: false, skipped: true }

  const messages = await listMessages(supabase, userId, activeId, 80)
  const title = sessionTitleFromMessages(messages)

  const { error } = await supabase
    .from("command_center_threads")
    .update({
      status: "archived",
      title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", activeId)
    .eq("user_id", userId)

  if (error) {
    if (isMissingStatusColumn(error)) {
      return { archived: false, skipped: true }
    }
    throw new Error(error.message)
  }

  return { archived: true, sessionId: activeId }
}

/**
 * Archives any active companion thread and creates a new active one.
 * Used when opening the Command Center for a clean slate.
 */
export async function rotateCompanionSession(
  supabase: SupabaseClient,
  userId: string,
  listMessages: (
    supabase: SupabaseClient,
    userId: string,
    threadId: string,
    limit?: number,
  ) => Promise<CommandCenterMessageRecord[]>,
): Promise<string> {
  const activeId = await getActiveCompanionThreadId(supabase, userId)

  if (activeId) {
    const messages = await listMessages(supabase, userId, activeId, 80)
    const title = sessionTitleFromMessages(messages)

    const { error: archiveError } = await supabase
      .from("command_center_threads")
      .update({
        status: "archived",
        title,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeId)
      .eq("user_id", userId)

    if (archiveError && isMissingStatusColumn(archiveError)) {
      await supabase
        .from("command_center_messages")
        .delete()
        .eq("thread_id", activeId)
        .eq("user_id", userId)
      return activeId
    }
    if (archiveError && !isMissingCommandCenterTableError(archiveError)) {
      throw new Error(archiveError.message)
    }
  }

  const { error: bulkArchiveError } = await supabase
    .from("command_center_threads")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("focus_type", "companion")
    .eq("status", "active")

  if (
    bulkArchiveError &&
    !isMissingStatusColumn(bulkArchiveError) &&
    !isMissingCommandCenterTableError(bulkArchiveError)
  ) {
    throw new Error(bulkArchiveError.message)
  }

  const existingActive = await getActiveCompanionThreadId(supabase, userId)
  if (existingActive) {
    return existingActive
  }

  return createActiveCompanionThread(supabase, userId)
}

export async function listArchivedCompanionSessions(
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<CompanionSessionSummary[]> {
  const { data, error } = await supabase
    .from("command_center_threads")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .eq("focus_type", "companion")
    .eq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingStatusColumn(error) || isMissingCommandCenterTableError(error)) return []
    throw new Error(error.message)
  }

  const sessions: CompanionSessionSummary[] = []
  for (const row of data ?? []) {
    const threadId = String(row.id)
    const { count } = await supabase
      .from("command_center_messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadId)
      .eq("user_id", userId)

    const { data: lastMsg } = await supabase
      .from("command_center_messages")
      .select("content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    sessions.push({
      id: threadId,
      title: String(row.title || "Companion session"),
      updatedAt: String(row.updated_at),
      preview: String(lastMsg?.content ?? "").slice(0, 120),
      messageCount: count ?? 0,
    })
  }

  return sessions
}

export async function getThreadStatus(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
): Promise<"active" | "archived" | "unknown"> {
  const { data, error } = await supabase
    .from("command_center_threads")
    .select("status, focus_type")
    .eq("id", threadId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data) return "unknown"
  if (data.focus_type !== "companion") return "unknown"
  const status = data.status as string | undefined
  if (status === "archived") return "archived"
  if (status === "active") return "active"
  return "active"
}
