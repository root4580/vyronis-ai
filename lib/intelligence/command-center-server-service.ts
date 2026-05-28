import type { SupabaseClient } from "@supabase/supabase-js"
import { detectPrimaryLeak } from "@/lib/behavior/leak-engine"
import type { LeakEngineInput } from "@/lib/behavior/types"
import {
  generatePatternMemory,
  type PatternMemoryFeedback,
  type PatternMemorySession,
  type PatternMemoryTrade,
} from "@/lib/trade-coach/pattern-memory"
import type { PlannedVsActualComparison, PreTradePlannedContext } from "@/lib/trade-coach/types"
import { listPlannedCoachSessions } from "@/lib/trade-coach/server-service"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import { buildTraderContextMemory } from "@/lib/intelligence/trader-context"
import {
  buildConversationalGreeting,
  generateCompanionDialogue,
} from "@/lib/intelligence/companion-dialogue-engine"
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

async function loadProfileName(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle()
  return data?.display_name ?? null
}

async function loadTrades(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("trades")
    .select(
      "id, pair, direction, result, pnl, emotion, emotion_after, strategy_name, session, risk_percent, rule_followed, mistake_tags, confirmation_signal, trade_date, created_at, setup, setup_classification",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

async function loadPatternInputs(supabase: SupabaseClient, userId: string, maxRiskPerTrade: number) {
  const trades = (await loadTrades(supabase, userId)) as PatternMemoryTrade[]

  const { data: feedbackRows, error: feedbackError } = await supabase
    .from("trade_coach_feedback")
    .select("trade_id, discipline_score, planned_vs_actual")
    .eq("user_id", userId)

  let feedback: PatternMemoryFeedback[] = []
  if (!feedbackError) {
    feedback = (feedbackRows || []).map((row) => ({
      trade_id: String(row.trade_id),
      discipline_score: row.discipline_score,
      planned_vs_actual: (row.planned_vs_actual || []) as PlannedVsActualComparison[],
    }))
  }

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("trade_coach_sessions")
    .select("trade_id, planned_context")
    .eq("user_id", userId)
    .not("trade_id", "is", null)

  let sessions: PatternMemorySession[] = []
  if (!sessionsError) {
    sessions = (sessionRows || []).map((row) => ({
      trade_id: row.trade_id ? String(row.trade_id) : null,
      planned_context: (row.planned_context || {}) as PreTradePlannedContext,
    }))
  }

  return generatePatternMemory({ trades, feedback, sessions, maxRiskPerTrade })
}

async function loadUnreadSignalCount(supabase: SupabaseClient, userId: string) {
  const { count, error } = await supabase
    .from("tradingview_signals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)

  if (error && !isMissingTableError(error)) return 0
  return count ?? 0
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

async function buildMemoryBundle(supabase: SupabaseClient, userId: string) {
  const settings = await loadUserSettings(supabase, userId)
  const traderName = await loadProfileName(supabase, userId)
  const trades = await loadTrades(supabase, userId)
  const patternResult = await loadPatternInputs(supabase, userId, settings.maxRiskPerTrade)
  const plannedSessions = await listPlannedCoachSessions(supabase, userId)
  const unreadSignalCount = await loadUnreadSignalCount(supabase, userId)

  const leakTrades: LeakEngineInput["trades"] = trades.map((t) => ({
    id: String(t.id),
    direction: String(t.direction),
    result: String(t.result),
    pnl: Number(t.pnl),
    emotion: String(t.emotion),
    emotion_after: t.emotion_after,
    session: t.session,
    pair: String(t.pair || ""),
    setup: String(t.setup || ""),
    setup_classification: t.setup_classification,
    risk_percent: t.risk_percent,
    rule_followed: t.rule_followed,
    confirmation_signal: t.confirmation_signal,
    mistake_tags: t.mistake_tags,
    trade_date: t.trade_date,
    created_at: String(t.created_at),
    timestamp: new Date(t.created_at).getTime(),
    dayKey: "",
    hourOfDay: 0,
  }))

  const primaryLeak = detectPrimaryLeak({
    trades: leakTrades,
    maxRiskPerTrade: settings.maxRiskPerTrade,
  })

  const memory = buildTraderContextMemory({
    trades,
    maxRiskPerTrade: settings.maxRiskPerTrade,
    maxTradesPerDay: settings.maxTradesPerDay,
    primaryLeak,
    patterns: patternResult.patterns,
    plannedSessions,
    traderName,
    unreadSignalCount,
  })

  return { settings, memory, recentTrades: trades.slice(0, 12) as RecentTradeMemory[], traderName }
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
  const trimmed = content.trim()
  if (!trimmed) throw new Error("Message cannot be empty")

  const { memory, recentTrades } = await buildMemoryBundle(supabase, userId)
  const threadId = await getOrCreateCompanionThread(supabase, userId)
  const recentMessages = await listThreadMessages(supabase, userId, threadId, 40)

  const userMessage = await insertMessage(supabase, {
    userId,
    threadId,
    role: "user",
    messageType: "text",
    content: trimmed,
  })

  const dialogue = generateCompanionDialogue({
    userMessage: trimmed,
    memory,
    recentTrades,
    recentMessages: [...recentMessages, userMessage],
  })

  const assistantMessage = await insertMessage(supabase, {
    userId,
    threadId,
    role: "assistant",
    messageType: dialogue.isCriticalHighlight ? "warning" : "text",
    content: dialogue.content,
    payload: {
      replyEngine: "dialogue-v2",
      companionState: dialogue.companionState,
      followUpQuestion: dialogue.followUpQuestion,
      memoryReference: dialogue.memoryReference,
      mentionedWarningIds: dialogue.mentionedWarningIds,
      isCriticalHighlight: dialogue.isCriticalHighlight,
    },
  })

  await supabase
    .from("command_center_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId)

  const context = await getCommandCenterContext(supabase, userId, "companion")

  return {
    userMessage,
    assistantMessage,
    context,
    thinkingPhases: dialogue.thinkingPhases,
  }
}
