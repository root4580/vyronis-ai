import type { SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"
import { resolveAiProvider } from "@/lib/ai/providers"
import { BRIEFING_AGENT_ORDER, getCouncilAgent } from "@/lib/council/agents"
import {
  isCouncilMorningWindow,
  loadCouncilAgentContext,
} from "@/lib/council/context-service"
import {
  buildCouncilAgentSystemPrompt,
  buildCouncilBriefingUserPrompt,
  buildCouncilRespondUserPrompt,
} from "@/lib/council/prompts"
import { routeCouncilQuestion } from "@/lib/council/router"
import type {
  CouncilAgentId,
  CouncilBriefingResponse,
  CouncilRespondResponse,
  CouncilSessionRecord,
  CouncilSessionResponse,
  CouncilSettingsRecord,
  CouncilTranscriptEntry,
} from "@/lib/council/types"
import { isCouncilVoiceOutputConfigured } from "@/lib/council/voices"
import { isCouncilListenConfigured } from "@/lib/council/whisper-service"

export class CouncilTablesMissingError extends Error {
  constructor() {
    super("Council tables are missing. Run supabase/RUN-COUNCIL.sql in Supabase.")
    this.name = "CouncilTablesMissingError"
  }
}

function isMissingCouncilTable(message: string): boolean {
  return /council_sessions|agent_memories|council_settings|relation .* does not exist|schema cache/i.test(
    message,
  )
}

function todayDateISO(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function normalizeSession(row: Record<string, unknown>): CouncilSessionRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    account_id: row.account_id != null ? String(row.account_id) : null,
    session_date: String(row.session_date).slice(0, 10),
    agents_spoken: Array.isArray(row.agents_spoken)
      ? row.agents_spoken.map(String)
      : [],
    full_transcript: Array.isArray(row.full_transcript)
      ? (row.full_transcript as CouncilTranscriptEntry[])
      : [],
    key_insights: Array.isArray(row.key_insights) ? row.key_insights.map(String) : [],
    briefing_completed: Boolean(row.briefing_completed),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function normalizeSettings(row: Record<string, unknown>): CouncilSettingsRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    sarah_voice_id: row.sarah_voice_id != null ? String(row.sarah_voice_id) : null,
    adam_voice_id: row.adam_voice_id != null ? String(row.adam_voice_id) : null,
    scott_voice_id: row.scott_voice_id != null ? String(row.scott_voice_id) : null,
    hamza_voice_id: row.hamza_voice_id != null ? String(row.hamza_voice_id) : null,
    khalid_voice_id: row.khalid_voice_id != null ? String(row.khalid_voice_id) : null,
    auto_briefing_enabled: row.auto_briefing_enabled !== false,
    briefing_time: String(row.briefing_time ?? "on_login"),
    language_preference: String(row.language_preference ?? "en"),
    last_briefing_date:
      row.last_briefing_date != null ? String(row.last_briefing_date).slice(0, 10) : null,
    updated_at: String(row.updated_at),
  }
}

function fallbackAgentLine(agentId: CouncilAgentId, context: Awaited<ReturnType<typeof loadCouncilAgentContext>>): string {
  switch (agentId) {
    case "sarah":
      return `${context.chapterLabel} is underway. You have ${context.sarah.includes("remaining") ? "trades to protect" : "room to execute with discipline"}. Last week's lesson still counts — stay patient.`
    case "scott":
      return context.scott.split(".").slice(0, 2).join(".") + "."
    case "hamza":
      return context.hamza.includes("No War Room")
        ? "Save your War Room watchlist first — I will highlight the best A+ setup once pairs are loaded."
        : `Strongest focus: ${context.hamza.split("·")[0]?.trim() || "your top watchlist pair"}.`
    case "khalid":
      return context.khalid.includes("No setups")
        ? "No confirmed setup yet — align HTF bias and AOI before entry."
        : context.khalid.split("|")[0]?.trim() || "Wait for M15 close confirmation before entry."
    case "adam":
      return context.adam.includes("No live")
        ? "No live trades to review yet — paper your plan until the journal has data."
        : context.adam.split(".")[0] + "."
  }
}

async function generateAgentText(input: {
  agentId: CouncilAgentId
  systemPrompt: string
  userPrompt: string
  fallback: string
}): Promise<string> {
  const provider = resolveAiProvider()
  if (provider?.completeText) {
    try {
      const text = await provider.completeText({
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        maxTokens: 180,
        temperature: 0.45,
      })
      if (text.trim()) return text.trim()
    } catch {
      // fall through
    }
  }
  return input.fallback
}

export async function getOrCreateCouncilSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<CouncilSettingsRecord | null> {
  const { data, error } = await supabase
    .from("council_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    if (isMissingCouncilTable(error.message)) throw new CouncilTablesMissingError()
    throw new Error(error.message)
  }

  if (data) return normalizeSettings(data as Record<string, unknown>)

  const { data: created, error: insertError } = await supabase
    .from("council_settings")
    .insert({ user_id: userId })
    .select("*")
    .single()

  if (insertError) {
    if (isMissingCouncilTable(insertError.message)) throw new CouncilTablesMissingError()
    throw new Error(insertError.message)
  }

  return normalizeSettings(created as Record<string, unknown>)
}

export async function getTodayCouncilSession(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<CouncilSessionRecord | null> {
  const sessionDate = todayDateISO()
  const { data, error } = await supabase
    .from("council_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("session_date", sessionDate)
    .maybeSingle()

  if (error) {
    if (isMissingCouncilTable(error.message)) throw new CouncilTablesMissingError()
    throw new Error(error.message)
  }

  return data ? normalizeSession(data as Record<string, unknown>) : null
}

async function upsertTodaySession(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  patch: Partial<CouncilSessionRecord> & { full_transcript?: CouncilTranscriptEntry[] },
): Promise<CouncilSessionRecord> {
  const sessionDate = todayDateISO()
  const existing = await getTodayCouncilSession(supabase, userId, accountId)
  const now = new Date().toISOString()

  if (existing) {
    const { data, error } = await supabase
      .from("council_sessions")
      .update({
        agents_spoken: patch.agents_spoken ?? existing.agents_spoken,
        full_transcript: patch.full_transcript ?? existing.full_transcript,
        key_insights: patch.key_insights ?? existing.key_insights,
        briefing_completed: patch.briefing_completed ?? existing.briefing_completed,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select("*")
      .single()

    if (error) throw new Error(error.message)
    return normalizeSession(data as Record<string, unknown>)
  }

  const { data, error } = await supabase
    .from("council_sessions")
    .insert({
      user_id: userId,
      account_id: accountId,
      session_date: sessionDate,
      agents_spoken: patch.agents_spoken ?? [],
      full_transcript: patch.full_transcript ?? [],
      key_insights: patch.key_insights ?? [],
      briefing_completed: patch.briefing_completed ?? false,
      updated_at: now,
    })
    .select("*")
    .single()

  if (error) {
    if (isMissingCouncilTable(error.message)) throw new CouncilTablesMissingError()
    throw new Error(error.message)
  }

  return normalizeSession(data as Record<string, unknown>)
}

async function appendAgentMemory(
  supabase: SupabaseClient,
  userId: string,
  agentId: CouncilAgentId,
  userMessage: string,
  agentReply: string,
): Promise<void> {
  const { data } = await supabase
    .from("agent_memories")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_name", agentId)
    .maybeSingle()

  const entry = {
    at: new Date().toISOString(),
    user: userMessage,
    agent: agentReply,
  }

  const previous = Array.isArray(data?.last_10_conversations)
    ? (data.last_10_conversations as typeof entry[])
    : []

  const payload = {
    user_id: userId,
    agent_name: agentId,
    last_10_conversations: [entry, ...previous].slice(0, 10),
    last_session_date: todayDateISO(),
    total_sessions: Number(data?.total_sessions ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }

  await supabase.from("agent_memories").upsert(payload, { onConflict: "user_id,agent_name" })
}

export async function getCouncilSessionState(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<CouncilSessionResponse> {
  try {
    const [settings, session] = await Promise.all([
      getOrCreateCouncilSettings(supabase, userId),
      getTodayCouncilSession(supabase, userId, accountId),
    ])
    return {
      session,
      settings,
      isMorningWindow: isCouncilMorningWindow(),
      voiceConfigured: isCouncilVoiceOutputConfigured(),
      listenConfigured: isCouncilListenConfigured(),
    }
  } catch (error) {
    if (error instanceof CouncilTablesMissingError) {
      return {
        session: null,
        settings: null,
        isMorningWindow: isCouncilMorningWindow(),
        migrationPending: true,
      }
    }
    throw error
  }
}

export async function runCouncilMorningBriefing(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  options?: { force?: boolean },
): Promise<CouncilBriefingResponse> {
  const context = await loadCouncilAgentContext(supabase, userId, accountId)
  const settings = await getOrCreateCouncilSettings(supabase, userId)
  const existing = await getTodayCouncilSession(supabase, userId, accountId)

  if (existing?.briefing_completed && !options?.force) {
    return {
      sessionId: existing.id,
      messages: existing.full_transcript.filter((entry) => entry.agent !== "user"),
    }
  }

  const transcript: CouncilTranscriptEntry[] = existing?.full_transcript ?? []
  const newMessages: CouncilTranscriptEntry[] = []
  const agentsSpoken: string[] = []

  for (const agentId of BRIEFING_AGENT_ORDER) {
    const agent = getCouncilAgent(agentId)
    const systemPrompt = buildCouncilAgentSystemPrompt(agentId, context)
    const content = await generateAgentText({
      agentId,
      systemPrompt,
      userPrompt: buildCouncilBriefingUserPrompt(agentId),
      fallback: fallbackAgentLine(agentId, context),
    })

    const entry: CouncilTranscriptEntry = {
      id: randomUUID(),
      agent: agentId,
      content,
      createdAt: new Date().toISOString(),
    }
    newMessages.push(entry)
    agentsSpoken.push(agent.name)
  }

  const merged = [...transcript, ...newMessages]
  const session = await upsertTodaySession(supabase, userId, accountId, {
    full_transcript: merged,
    agents_spoken: agentsSpoken,
    briefing_completed: true,
    key_insights: newMessages.map((message) => message.content.slice(0, 120)),
  })

  await supabase
    .from("council_settings")
    .update({
      last_briefing_date: todayDateISO(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)

  return {
    sessionId: session.id,
    messages: newMessages,
  }
}

export async function runCouncilRespond(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  message: string,
  preferredAgent?: CouncilAgentId,
): Promise<CouncilRespondResponse> {
  const trimmed = message.trim()
  if (!trimmed) {
    throw new Error("Message is required")
  }

  const context = await loadCouncilAgentContext(supabase, userId, accountId)
  const agentId = preferredAgent ?? routeCouncilQuestion(trimmed)
  const existing = await getTodayCouncilSession(supabase, userId, accountId)
  const transcript = existing?.full_transcript ?? []

  const userEntry: CouncilTranscriptEntry = {
    id: randomUUID(),
    agent: "user",
    content: trimmed,
    createdAt: new Date().toISOString(),
  }

  const recentTranscript = transcript
    .slice(-8)
    .map((entry) => {
      const speaker =
        entry.agent === "user" ? context.traderFirstName : getCouncilAgent(entry.agent as CouncilAgentId).name
      return `${speaker}: ${entry.content}`
    })
    .join("\n")

  const reply = await generateAgentText({
    agentId,
    systemPrompt: buildCouncilAgentSystemPrompt(agentId, context),
    userPrompt: buildCouncilRespondUserPrompt({ question: trimmed, recentTranscript }),
    fallback: fallbackAgentLine(agentId, context),
  })

  const agentEntry: CouncilTranscriptEntry = {
    id: randomUUID(),
    agent: agentId,
    content: reply,
    createdAt: new Date().toISOString(),
  }

  const session = await upsertTodaySession(supabase, userId, accountId, {
    full_transcript: [...transcript, userEntry, agentEntry],
    agents_spoken: [...new Set([...(existing?.agents_spoken ?? []), getCouncilAgent(agentId).name])],
  })

  await appendAgentMemory(supabase, userId, agentId, trimmed, reply).catch(() => undefined)

  return {
    sessionId: session.id,
    agent: agentId,
    message: agentEntry,
  }
}
