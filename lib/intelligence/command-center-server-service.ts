import type { SupabaseClient } from "@supabase/supabase-js"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import { buildMemoryBundle } from "@/lib/intelligence/memory-bundle"
import { buildConversationalGreeting } from "@/lib/intelligence/companion-dialogue-engine"
import { GREETING_VERSION, getLocalDateKey } from "@/lib/intelligence/greeting-engine"
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile"
import { generateCompanionIntelligenceReply } from "@/lib/intelligence/companion-llm-engine"
import { compressInteractionMemory, storeMemoryInsight } from "@/lib/intelligence/memory-compression"
import { persistCognitiveSnapshot } from "@/lib/intelligence/cognitive-snapshot-service"
import {
  buildToneMemoryInsightPayload,
  inferMessageTone,
} from "@/lib/intelligence/tone-memory-engine"
import { syncAutonomousPersistence } from "@/lib/autonomous/server-service"
import { hasSessionMoodCheckIn } from "@/lib/coach/session-mood-check-in"
import { sanitizeCompanionMessage } from "@/lib/command-center/mood-gate"
import { buildFullTraderContext } from "@/lib/intelligence/trader-context-builder"
import { buildEmptyPlannedContext } from "@/lib/trade-coach/planned-context"
import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import {
  analyzeCommandCenterBundle,
  analyzeCommandCenterChart,
} from "@/lib/intelligence/command-center-vision-engine"
import {
  linkBundleAnalysisToCoachSession,
  linkChartAnalysisToCoachSession,
} from "@/lib/intelligence/command-center-chart-link"
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
import { CommandCenterTableMissingError } from "@/lib/command-center/errors"
import {
  archiveActiveCompanionSession,
  createActiveCompanionThread,
  getActiveCompanionThreadId,
  getThreadStatus,
  listArchivedCompanionSessions,
  rotateCompanionSession,
  type CompanionSessionSummary,
} from "@/lib/command-center/session-service"

export { CommandCenterTableMissingError }
export type { CompanionSessionSummary }
export {
  archiveActiveCompanionSession,
  listArchivedCompanionSessions,
  rotateCompanionSession,
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
  return sanitizeCompanionMessage({
    id: String(row.id),
    thread_id: String(row.thread_id),
    role: row.role as CommandCenterMessageRecord["role"],
    message_type: row.message_type as CommandCenterMessageRecord["message_type"],
    content: String(row.content),
    payload: (row.payload || {}) as Record<string, unknown>,
    created_at: String(row.created_at),
  })
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
  const activeId = await getActiveCompanionThreadId(supabase, userId)
  if (activeId) return activeId
  return createActiveCompanionThread(supabase, userId)
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

function todayKey(timeZone = DEFAULT_USER_PROFILE.timezone) {
  return getLocalDateKey(new Date(), timeZone)
}

async function ensureDailyGreeting(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  memory: Awaited<ReturnType<typeof buildMemoryBundle>>["memory"],
  recentTrades: RecentTradeMemory[],
  traderName: string | null,
  timeZone: string,
  existingMessages?: CommandCenterMessageRecord[],
) {
  const allMessages =
    existingMessages ?? (await listThreadMessages(supabase, userId, threadId, 80))
  const lastGreeting = [...allMessages].reverse().find((m) => m.message_type === "greeting")
  const greetingDay = lastGreeting?.payload?.dayKey
  const greetingVersion = lastGreeting?.payload?.greetingVersion
  const localDayKey = todayKey(timeZone)

  if (greetingDay === localDayKey && lastGreeting && greetingVersion === GREETING_VERSION) {
    return allMessages
  }

  const greeting = buildConversationalGreeting({
    memory,
    recentTrades,
    traderName,
    timeZone,
  })

  const seededWarningIds = greetingWarningIds(memory)

  await insertMessage(supabase, {
    userId,
    threadId,
    role: "assistant",
    messageType: "greeting",
    content: greeting.content,
    payload: {
      dayKey: localDayKey,
      greetingVersion: GREETING_VERSION,
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
  options?: { sessionThreadId?: string | null; fresh?: boolean; lean?: boolean },
): Promise<CommandCenterContext> {
  const [{ settings, memory, recentTrades, traderName, timeZone }, activeCompanionThreadId] =
    await Promise.all([
      buildMemoryBundle(supabase, userId),
      options?.fresh && mode === "companion" && !options?.sessionThreadId
        ? rotateCompanionSession(supabase, userId, listThreadMessages)
        : getOrCreateCompanionThread(supabase, userId),
    ])

  const viewSessionId = options?.sessionThreadId?.trim() || null
  const viewingArchived =
    viewSessionId != null &&
    viewSessionId !== activeCompanionThreadId &&
    (await getThreadStatus(supabase, userId, viewSessionId)) === "archived"

  let companionThreadId = activeCompanionThreadId
  let messages: CommandCenterMessageRecord[]

  if (viewingArchived && viewSessionId) {
    messages = await listThreadMessages(supabase, userId, viewSessionId, 80)
    companionThreadId = viewSessionId
  } else {
    const initialMessages = await listThreadMessages(
      supabase,
      userId,
      activeCompanionThreadId,
      80,
    )
    messages = await ensureDailyGreeting(
      supabase,
      userId,
      activeCompanionThreadId,
      memory,
      recentTrades,
      traderName,
      timeZone,
      initialMessages,
    )
  }

  let threadId = activeCompanionThreadId
  if (viewingArchived && viewSessionId) {
    threadId = viewSessionId
  } else if (mode !== "companion" && focusId) {
    threadId = await getOrCreateThread(supabase, userId, mode, focusId)
  }

  const companionState = resolveCompanionStateFromThread(messages, memory)
  const freshWarnings = getFreshWarnings(memory.warnings, messages)

  const traderContext = options?.lean
    ? null
    : await buildFullTraderContext(supabase, userId, {
        focusId,
        recentMessages: messages,
      }).catch(() => null)

  let sessionTitle: string | null = null
  if (viewingArchived && viewSessionId) {
    const { data: threadRow } = await supabase
      .from("command_center_threads")
      .select("title")
      .eq("id", viewSessionId)
      .eq("user_id", userId)
      .maybeSingle()
    sessionTitle = threadRow?.title ? String(threadRow.title) : "Past session"
  }

  return {
    enabled: settings.enabled,
    threadId,
    companionThreadId: activeCompanionThreadId,
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
    autonomous: traderContext?.autonomous ?? null,
    cognitive: traderContext?.cognitive ?? null,
    tradingOs: traderContext?.tradingOs ?? null,
    adaptiveCognition: traderContext?.adaptiveCognition ?? null,
    vyronisCore: traderContext?.vyronisCore ?? null,
    viewingArchivedSession: viewingArchived,
    sessionTitle,
  }
}

function applySessionMoodToContext(
  context: FullTraderContext,
  sessionMood: string | null | undefined,
): FullTraderContext {
  const mood = sessionMood?.trim()
  if (!mood) return context
  const planned = context.activePlannedContext ?? buildEmptyPlannedContext()
  return {
    ...context,
    activePlannedContext: { ...planned, emotion: mood },
  }
}

function resolveSessionMood(inputMood: string | null | undefined): string | null {
  return inputMood?.trim() || null
}

export async function postCommandCenterChat(
  supabase: SupabaseClient,
  userId: string,
  input: {
    content: string
    imageUrl?: string | null
    imageUrls?: string[] | null
    mode?: CommandCenterMode
    focusId?: string | null
    sessionMood?: string | null
  },
): Promise<{
  userMessage: CommandCenterMessageRecord
  assistantMessage: CommandCenterMessageRecord
  context: CommandCenterContext
  thinkingPhases: string[]
  engine: "llm" | "heuristic" | "vision"
  decision?: import("@/lib/intelligence/intelligence-types").TradeDecisionResult
  chartVision?: import("@/lib/intelligence/command-center-vision-engine").CommandCenterVisionAnalysis
}> {
  const trimmed = input.content.trim()
  const imageUrls = (
    input.imageUrls?.map((url) => url?.trim()).filter(Boolean) as string[] | undefined
  ) ?? (input.imageUrl?.trim() ? [input.imageUrl.trim()] : [])
  const imageUrl = imageUrls[0] ?? null
  const isBundle = imageUrls.length > 1
  if (!trimmed && imageUrls.length === 0) throw new Error("Message cannot be empty")

  const content =
    trimmed ||
    (isBundle
      ? `📷 ${imageUrls.length} chart screenshots (timeframe bundle)`
      : imageUrl
        ? "📷 Chart uploaded"
        : "")

  const mode = input.mode ?? "companion"
  const threadId =
    mode === "companion"
      ? await getOrCreateCompanionThread(supabase, userId)
      : await getOrCreateThread(supabase, userId, mode, input.focusId)

  const recentMessages = await listThreadMessages(supabase, userId, threadId, 40)

  let fullContext = await buildFullTraderContext(supabase, userId, {
    focusId: input.focusId,
    recentMessages,
  })
  fullContext = applySessionMoodToContext(fullContext, input.sessionMood)

  const sessionMood = resolveSessionMood(input.sessionMood)
  if (imageUrls.length > 0 && !hasSessionMoodCheckIn(sessionMood)) {
    const userMessage = await insertMessage(supabase, {
      userId,
      threadId,
      role: "user",
      messageType: "analysis",
      content,
      payload: {
        imageUrl,
        imageUrls,
        analysisKind: isBundle ? "timeframe_bundle" : "single_chart",
        pendingMoodGate: true,
      },
    })

    const assistantMessage = await insertMessage(supabase, {
      userId,
      threadId,
      role: "assistant",
      messageType: "text",
      content:
        "Before I score this setup, tell me how you're feeling right now. Use the mood check-in below — Coach won't judge trader state from journal history until you do.",
      payload: {
        replyEngine: "mood-gate-v1",
        requiresMoodCheckIn: true,
      },
    })

    await supabase
      .from("command_center_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId)

    const context = await getCommandCenterContext(supabase, userId, mode, input.focusId)

    return {
      userMessage,
      assistantMessage,
      context,
      thinkingPhases: ["Waiting for mood check-in…"],
      engine: "heuristic",
    }
  }

  const chartVision =
    imageUrls.length > 0
      ? isBundle
        ? await analyzeCommandCenterBundle({
            imageUrls,
            plannedContext: fullContext.activePlannedContext,
          })
        : await analyzeCommandCenterChart({
            imageUrl: imageUrls[0],
            plannedContext: fullContext.activePlannedContext,
          })
      : null

  const userMessage = await insertMessage(supabase, {
    userId,
    threadId,
    role: "user",
    messageType: imageUrls.length > 0 ? "analysis" : "text",
    content,
    payload:
      imageUrls.length > 0
        ? {
            imageUrl,
            imageUrls,
            analysisKind: isBundle ? "timeframe_bundle" : "single_chart",
            bundleSessionId: chartVision?.bundle?.sessionId,
          }
        : {},
  })

  const dialogue = await generateCompanionIntelligenceReply({
    userMessage: content,
    context: fullContext,
    recentMessages: [...recentMessages, userMessage],
    chartVision,
  })

  const assistantMessage = await insertMessage(supabase, {
    userId,
    threadId,
    role: "assistant",
    messageType: chartVision
      ? "analysis"
      : dialogue.isCriticalHighlight
        ? "warning"
        : "text",
    content: dialogue.content,
    payload: {
      replyEngine:
        dialogue.engine === "vision"
          ? "intelligence-vision-v1"
          : dialogue.engine === "llm"
            ? "intelligence-llm-v1"
            : "dialogue-v3-intent",
      companionState: dialogue.companionState,
      followUpQuestion: dialogue.followUpQuestion,
      mentionedWarningIds: dialogue.mentionedWarningIds,
      isCriticalHighlight: dialogue.isCriticalHighlight,
      intent: dialogue.intent,
      decision: dialogue.decision,
      sessionMoodAtAnalysis: chartVision ? sessionMood : null,
      imageUrl: chartVision?.imageUrl,
      imageUrls: chartVision?.imageUrls,
      analysisKind: chartVision?.bundle ? "timeframe_bundle" : chartVision?.imageUrl ? "single_chart" : undefined,
      bundleSessionId: chartVision?.bundle?.sessionId,
      timeframeBundle: chartVision?.bundle
        ? {
            inferredStack: chartVision.bundle.inferredStack,
            frames: chartVision.bundle.frames,
          }
        : undefined,
      chartVision: chartVision?.vision,
      visionChecklist: chartVision?.checklist,
    },
  })

  if (mode === "pre_trade" && input.focusId && chartVision?.vision && chartVision.legacy) {
    if (chartVision.bundle) {
      await linkBundleAnalysisToCoachSession(supabase, userId, input.focusId, {
        bundle: chartVision.bundle,
        vision: chartVision.vision,
        legacy: chartVision.legacy,
      }).catch(() => null)
    } else {
      await linkChartAnalysisToCoachSession(supabase, userId, input.focusId, {
        imageUrl: chartVision.imageUrl,
        vision: chartVision.vision,
        legacy: chartVision.legacy,
      }).catch(() => null)
    }
  }

  if (fullContext.autonomous && (mode === "pre_trade" || imageUrls.length > 0)) {
    await syncAutonomousPersistence(supabase, userId, fullContext.autonomous, {
      persistShadow: true,
      coachSessionId: input.focusId ?? undefined,
    }).catch(() => null)
  }

  await compressInteractionMemory(supabase, {
    userId,
    threadId,
    context: fullContext,
    intent: dialogue.intent,
    userMessage: content,
    assistantReply: dialogue.content,
    sourceMessageId: assistantMessage.id,
    decision: dialogue.decision,
    chartVision,
  }).catch(() => null)

  if (fullContext.cognitive) {
    await persistCognitiveSnapshot(supabase, userId, fullContext.cognitive, {
      coachSessionId: input.focusId ?? undefined,
    }).catch(() => null)
  }

  const tone = inferMessageTone(content)
  if (tone !== "neutral") {
    const payload = buildToneMemoryInsightPayload({
      tone,
      intent: dialogue.intent,
      snippet: content,
    })
    await storeMemoryInsight(supabase, {
      userId,
      threadId,
      sourceMessageId: userMessage.id,
      category: payload.category,
      insight: payload.insight,
      metadata: payload.metadata,
    }).catch(() => null)
  }

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
    chartVision: chartVision ?? undefined,
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
