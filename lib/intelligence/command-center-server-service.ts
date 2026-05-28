import type { SupabaseClient } from "@supabase/supabase-js"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import { buildMemoryBundle } from "@/lib/intelligence/memory-bundle"
import { buildConversationalGreeting } from "@/lib/intelligence/companion-dialogue-engine"
import { generateCompanionIntelligenceReply } from "@/lib/intelligence/companion-llm-engine"
import { compressInteractionMemory } from "@/lib/intelligence/memory-compression"
import { buildFullTraderContext } from "@/lib/intelligence/trader-context-builder"
import type { RecentTradeMemory } from "@/lib/intelligence/conversational-types"
import { resolveCompanionState } from "@/lib/intelligence/conversational-state-engine"
import {
  getFreshWarnings,
  greetingWarningIds,
  resolveCompanionStateFromThread,
} from "@/lib/intelligence/companion-context-utils"
import type {
  CommandCenterContext,
  CommandCenterMessageRecord,
  CommandCenterMode,
} from "@/lib/command-center/types"

export class CommandCenterTableMissingError extends Error {
  constructor(message = "Command center tables missing. Run supabase/014-command-center-foundation.sql.") {
    super(message)
    this.name = "CommandCenterTableMissingError"
  }
}

function isMissingTableError(error: { message?: string; code?: string } | null) {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|schema cache/i.test(error.message || "")
  )
}

function mapMessage(row: Record<string, unknown>): CommandCenterMessageRecord {
  return {
    id: String(row.id),
    thread_id: String(row.thread_id),
    role: row.role as CommandCenterMessageRecord["role"],
    message_type: row.message_type as CommandCenterMessageRecord["message_type"],
    content: String(row.content),
    payload: (row.payload || {}) as Record<string, unknown>,
    created_at: String(row.created_at),
  }
}

async function loadUserSettings(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("user_settings")
    .select(
      "max_risk_per_trade, max_trades_per_day, command_center_enabled, preferred_session",
    )
    .eq("user_id", userId)
    .maybeSingle()

  return {
    maxRiskPerTrade: data?.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade,
    maxTradesPerDay: data?.max_trades_per_day ?? DEFAULT_USER_SETTINGS.max_trades_per_day,
    enabled: data?.command_center_enabled ?? true,
  }
}

export async function getOrCreateThread(
  supabase: SupabaseClient,
  userId: string,
  focusType: CommandCenterMode | "companion" = "companion",
  focusId?: string | null,
): Promise<string> {
  if (focusType === "companion") {
    return getOrCreateCompanionThread(supabase, userId)
  }

  if (!focusId) {
    throw new Error(`focusId is required for ${focusType} threads`)
  }

  const { data: existing, error: findError } = await supabase
    .from("command_center_threads")
    .select("id")
    .eq("user_id", userId)
    .eq("focus_type", focusType)
    .eq("focus_id", focusId)
    .maybeSingle()

  if (findError && isMissingTableError(findError)) {
    throw new CommandCenterTableMissingError()
  }
  if (findError) throw new Error(findError.message)
  if (existing?.id) return String(existing.id)

  const title =
    focusType === "pre_trade"
      ? "Pre-trade review"
      : focusType === "post_trade"
        ? "Post-trade debrief"
        : "Weekly review"

  const { data: created, error: createError } = await supabase
    .from("command_center_threads")
    .insert({
      user_id: userId,
      focus_type: focusType,
      focus_id: focusId,
      title,
    })
    .select("id")
    .single()

  if (createError) {
    if (isMissingTableError(createError)) throw new CommandCenterTableMissingError()
    throw new Error(createError.message)
  }

  return String(created.id)
}

export async function getOrCreateCompanionThread(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from("command_center_threads")
    .select("id")
    .eq("user_id", userId)
    .eq("focus_type", "companion")
    .maybeSingle()

  if (findError && isMissingTableError(findError)) {
    throw new CommandCenterTableMissingError()
  }
  if (findError) throw new Error(findError.message)
  if (existing?.id) return String(existing.id)

  const { data: created, error: createError } = await supabase
    .from("command_center_threads")
    .insert({ user_id: userId, focus_type: "companion", title: "Vyronis Companion" })
    .select("id")
    .single()

  if (createError) {
    if (isMissingTableError(createError)) throw new CommandCenterTableMissingError()
    throw new Error(createError.message)
  }

  return String(created.id)
}

export async function listThreadMessages(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  limit = 80,
): Promise<CommandCenterMessageRecord[]> {
  const { data, error } = await supabase
    .from("command_center_messages")
    .select("id, thread_id, role, message_type, content, payload, created_at")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) throw new CommandCenterTableMissingError()
    throw new Error(error.message)
  }

  return (data || []).map(mapMessage)
}

async function insertMessage(
  supabase: SupabaseClient,
  input: {
    userId: string
    threadId: string
    role: CommandCenterMessageRecord["role"]
    messageType: CommandCenterMessageRecord["message_type"]
    content: string
    payload?: Record<string, unknown>
  },
) {
  const { data, error } = await supabase
    .from("command_center_messages")
    .insert({
      user_id: input.userId,
      thread_id: input.threadId,
      role: input.role,
      message_type: input.messageType,
      content: input.content,
      payload: input.payload ?? {},
    })
    .select("id, thread_id, role, message_type, content, payload, created_at")
    .single()

  if (error) throw new Error(error.message)
  return mapMessage(data)
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

async function ensureDailyGreeting(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  memory: Awaited<ReturnType<typeof buildMemoryBundle>>["memory"],
  recentTrades: RecentTradeMemory[],
  traderName: string | null,
) {
  const allMessages = await listThreadMessages(supabase, userId, threadId, 80)
  const lastGreeting = [...allMessages].reverse().find((m) => m.message_type === "greeting")
  const greetingDay = lastGreeting?.payload?.dayKey

  if (greetingDay === todayKey() && lastGreeting) {
    return allMessages
  }

  const greeting = buildConversationalGreeting({
    memory,
    recentTrades,
    traderName,
  })

  const seededWarningIds = greetingWarningIds(memory)

  await insertMessage(supabase, {
    userId,
    threadId,
    role: "assistant",
    messageType: "greeting",
    content: greeting.content,
    payload: {
      dayKey: todayKey(),
      companionState: greeting.companionState,
      mentionedWarningIds: seededWarningIds,
    },
  })

  await supabase
    .from("command_center_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId)

  return listThreadMessages(supabase, userId, threadId)
}

export async function appendModeTransitionMessage(
  supabase: SupabaseClient,
  userId: string,
  input: {
    mode: CommandCenterMode
    focusId?: string | null
    label: string
    direction: "enter" | "exit"
  },
): Promise<CommandCenterMessageRecord> {
  const companionThreadId = await getOrCreateCompanionThread(supabase, userId)

  const content =
    input.direction === "enter"
      ? `Entering ${input.label}`
      : `Returned to companion · ${input.label}`

  const message = await insertMessage(supabase, {
    userId,
    threadId: companionThreadId,
    role: "system",
    messageType: "system",
    content,
    payload: {
      mode: input.mode,
      focusId: input.focusId ?? null,
      direction: input.direction,
    },
  })

  await supabase
    .from("command_center_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", companionThreadId)

  return message
}

export async function switchCommandCenterMode(
  supabase: SupabaseClient,
  userId: string,
  input: {
    mode: CommandCenterMode
    focusId?: string | null
    label?: string
    direction?: "enter" | "exit"
  },
): Promise<CommandCenterContext> {
  const direction = input.direction ?? (input.mode === "companion" ? "exit" : "enter")
  const label =
    input.label ??
    (input.mode === "companion"
      ? "Companion"
      : input.mode === "pre_trade"
        ? "Pre-trade coach"
        : input.mode)

  if (label) {
    await appendModeTransitionMessage(supabase, userId, {
      mode: input.mode,
      focusId: input.focusId,
      label,
      direction,
    })
  }

  if (input.mode !== "companion" && input.focusId) {
    await getOrCreateThread(supabase, userId, input.mode, input.focusId)
  }

  return getCommandCenterContext(supabase, userId, input.mode, input.focusId ?? null)
}

export async function getCommandCenterContext(
  supabase: SupabaseClient,
  userId: string,
  mode: CommandCenterMode = "companion",
  focusId: string | null = null,
): Promise<CommandCenterContext> {
  const { settings, memory, recentTrades, traderName } = await buildMemoryBundle(supabase, userId)
  const companionThreadId = await getOrCreateCompanionThread(supabase, userId)
  const messages = await ensureDailyGreeting(
    supabase,
    userId,
    companionThreadId,
    memory,
    recentTrades,
    traderName,
  )

  let threadId = companionThreadId
  if (mode !== "companion" && focusId) {
    threadId = await getOrCreateThread(supabase, userId, mode, focusId)
  }

  const companionState = resolveCompanionStateFromThread(messages, memory)
  const freshWarnings = getFreshWarnings(memory.warnings, messages)

  return {
    enabled: settings.enabled,
    threadId,
    companionThreadId,
    mode,
    focusId,
    companionState,
    greeting: memory.greeting,
    warnings: memory.warnings,
    freshWarnings,
    snapshot: memory.snapshot,
    primaryLeak: memory.primaryLeak,
    topPatterns: memory.topPatterns,
    plannedSessions: memory.plannedSessions,
    messages,
  }
}

export async function postCommandCenterChat(
  supabase: SupabaseClient,
  userId: string,
  input: {
    content: string
    mode?: CommandCenterMode
    focusId?: string | null
  },
): Promise<{
  userMessage: CommandCenterMessageRecord
  assistantMessage: CommandCenterMessageRecord
  context: CommandCenterContext
  thinkingPhases: string[]
  engine: "llm" | "heuristic"
  decision?: import("@/lib/intelligence/intelligence-types").TradeDecisionResult
}> {
  const trimmed = input.content.trim()
  if (!trimmed) throw new Error("Message cannot be empty")

  const mode = input.mode ?? "companion"
  const threadId =
    mode === "companion"
      ? await getOrCreateCompanionThread(supabase, userId)
      : await getOrCreateThread(supabase, userId, mode, input.focusId)

  const recentMessages = await listThreadMessages(supabase, userId, threadId, 40)

  const fullContext = await buildFullTraderContext(supabase, userId, {
    focusId: input.focusId,
    recentMessages,
  })

  const userMessage = await insertMessage(supabase, {
    userId,
    threadId,
    role: "user",
    messageType: "text",
    content: trimmed,
  })

  const dialogue = await generateCompanionIntelligenceReply({
    userMessage: trimmed,
    context: fullContext,
    recentMessages: [...recentMessages, userMessage],
  })

  const assistantMessage = await insertMessage(supabase, {
    userId,
    threadId,
    role: "assistant",
    messageType: dialogue.isCriticalHighlight ? "warning" : "text",
    content: dialogue.content,
    payload: {
      replyEngine: dialogue.engine === "llm" ? "intelligence-llm-v1" : "dialogue-v3-intent",
      companionState: dialogue.companionState,
      followUpQuestion: dialogue.followUpQuestion,
      mentionedWarningIds: dialogue.mentionedWarningIds,
      isCriticalHighlight: dialogue.isCriticalHighlight,
      intent: dialogue.intent,
      decision: dialogue.decision,
    },
  })

  await compressInteractionMemory(supabase, {
    userId,
    threadId,
    context: fullContext,
    intent: dialogue.intent,
    userMessage: trimmed,
    assistantReply: dialogue.content,
    sourceMessageId: assistantMessage.id,
    decision: dialogue.decision,
  }).catch(() => null)

  await supabase
    .from("command_center_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId)

  const context = await getCommandCenterContext(supabase, userId, mode, input.focusId)

  return {
    userMessage,
    assistantMessage,
    context,
    thinkingPhases: dialogue.thinkingPhases,
    engine: dialogue.engine,
    decision: dialogue.decision,
  }
}

export async function postCommandCenterMessage(
  supabase: SupabaseClient,
  userId: string,
  content: string,
): Promise<{
  userMessage: CommandCenterMessageRecord
  assistantMessage: CommandCenterMessageRecord
  context: CommandCenterContext
  thinkingPhases: string[]
}> {
  const result = await postCommandCenterChat(supabase, userId, { content })
  return {
    userMessage: result.userMessage,
    assistantMessage: result.assistantMessage,
    context: result.context,
    thinkingPhases: result.thinkingPhases,
  }
}
