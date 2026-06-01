import type { SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"
import { resolveAiProvider } from "@/lib/ai/providers"
import { BRIEFING_AGENT_ORDER, getCouncilAgent } from "@/lib/council/agents"
import {
  LEGACY_COUNCIL_AGENT_NAME,
  LEGACY_COUNCIL_SETTINGS_VOICE_KEYS,
  normalizeCouncilAgentId,
  normalizeCouncilDisplayName,
} from "@/lib/council/agent-ids"
import {
  isCouncilMorningWindow,
  loadCouncilAgentContext,
} from "@/lib/council/context-service"
import {
  buildCouncilAgentSystemPrompt,
  buildCouncilBriefingUserPrompt,
  buildCouncilChimeInUserPrompt,
  buildCouncilHandoffAnswerUserPrompt,
  buildCouncilHandoffAskUserPrompt,
  buildCouncilRespondUserPrompt,
  buildRecentTranscriptLines,
  getLastAgentReplyInTranscript,
} from "@/lib/council/prompts"
import {
  buildChimeInFallback,
  buildHandoffAnswerFallback,
  buildHandoffAskFallback,
  pickCouncilChimeInAgent,
  pickCouncilCrossAgentHandoff,
} from "@/lib/council/multi-agent-orchestrator"
import {
  detectCouncilAgentByName,
  getStickyCouncilAgentFromTranscript,
  isCouncilDelegationRequest,
  resolveCouncilAgentForMessage,
  resolveCouncilPronounTarget,
} from "@/lib/council/router"
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

function normalizeTranscriptEntry(entry: CouncilTranscriptEntry): CouncilTranscriptEntry {
  if (entry.agent === "user" || entry.agent === "system") return entry
  const normalized = normalizeCouncilAgentId(String(entry.agent))
  return normalized ? { ...entry, agent: normalized } : entry
}

function readCouncilVoiceId(row: Record<string, unknown>, agentId: CouncilAgentId): string | null {
  const newKey = `${agentId}_voice_id`
  const legacyKey = LEGACY_COUNCIL_SETTINGS_VOICE_KEYS[agentId]
  const value = row[newKey] ?? row[legacyKey]
  return value != null ? String(value) : null
}

function normalizeSession(row: Record<string, unknown>): CouncilSessionRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    account_id: row.account_id != null ? String(row.account_id) : null,
    session_date: String(row.session_date).slice(0, 10),
    agents_spoken: Array.isArray(row.agents_spoken)
      ? row.agents_spoken.map((name) => normalizeCouncilDisplayName(String(name)))
      : [],
    full_transcript: Array.isArray(row.full_transcript)
      ? (row.full_transcript as CouncilTranscriptEntry[]).map(normalizeTranscriptEntry)
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
    nova_voice_id: readCouncilVoiceId(row, "nova"),
    zara_voice_id: readCouncilVoiceId(row, "zara"),
    rex_voice_id: readCouncilVoiceId(row, "rex"),
    luna_voice_id: readCouncilVoiceId(row, "luna"),
    cipher_voice_id: readCouncilVoiceId(row, "cipher"),
    auto_briefing_enabled: row.auto_briefing_enabled !== false,
    briefing_time: String(row.briefing_time ?? "on_login"),
    language_preference: String(row.language_preference ?? "en"),
    last_briefing_date:
      row.last_briefing_date != null ? String(row.last_briefing_date).slice(0, 10) : null,
    updated_at: String(row.updated_at),
  }
}

function buildConversationFallback(input: {
  agentId: CouncilAgentId
  context: Awaited<ReturnType<typeof loadCouncilAgentContext>>
  question: string
  lastReply: string | null
}): string {
  const trimmed = input.question.trim()

  if (/ready|in the zone|hit the zone|at aoi|confirmed/i.test(trimmed)) {
    if (input.agentId === "cipher") {
      return "Good — if price is in your AOI, wait for the M15 close in your direction before entry. Keep invalidation clear and do not chase the wick."
    }
    if (input.agentId === "luna") {
      return "Nice — if the zone is live, run Coach on the setup before you commit size."
    }
  }

  if (/how are we|how am i|how'?s it going/i.test(trimmed)) {
    if (input.agentId === "rex") {
      return input.context.rex.split(".").slice(0, 2).join(".") + "."
    }
  }

  if (input.lastReply) {
    return `Got it. Building on what I said — ${input.lastReply.split(".").slice(0, 1).join(".")}. What's the one thing you want to clarify next?`
  }

  return fallbackAgentLine(input.agentId, input.context)
}

function fallbackAgentLine(agentId: CouncilAgentId, context: Awaited<ReturnType<typeof loadCouncilAgentContext>>): string {
  switch (agentId) {
    case "nova":
      return `${context.chapterLabel} is underway. You have ${context.nova.includes("remaining") ? "trades to protect" : "room to execute with discipline"}. Last week's lesson still counts — stay patient.`
    case "rex":
      return context.rex.split(".").slice(0, 2).join(".") + "."
    case "luna":
      return context.luna.includes("No War Room")
        ? "Save your War Room watchlist first — I will highlight the best A+ setup once pairs are loaded."
        : `Strongest focus: ${context.luna.split("·")[0]?.trim() || "your top watchlist pair"}.`
    case "cipher":
      return context.cipher.includes("No setups")
        ? "No confirmed setup yet — align HTF bias and AOI before entry."
        : context.cipher.split("|")[0]?.trim() || "Wait for M15 close confirmation before entry."
    case "zara":
      return context.zara.includes("No live")
        ? "No live trades to review yet — paper your plan until the journal has data."
        : context.zara.split(".")[0] + "."
  }
}

async function generateAgentText(input: {
  agentId: CouncilAgentId
  systemPrompt: string
  userPrompt: string
  fallback: string
  temperature?: number
  maxTokens?: number
}): Promise<string> {
  const provider = resolveAiProvider()
  if (provider?.completeText) {
    try {
      const text = await provider.completeText({
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        maxTokens: input.maxTokens ?? 180,
        temperature: input.temperature ?? 0.45,
      })
      if (text.trim()) return text.trim()
    } catch {
      // fall through
    }
  }
  return input.fallback
}

async function produceCouncilAgentReply(input: {
  agentId: CouncilAgentId
  context: Awaited<ReturnType<typeof loadCouncilAgentContext>>
  userPrompt: string
  fallback: string
  temperature?: number
  maxTokens?: number
}): Promise<string> {
  return generateAgentText({
    agentId: input.agentId,
    systemPrompt: buildCouncilAgentSystemPrompt(input.agentId, input.context, "conversation"),
    userPrompt: input.userPrompt,
    fallback: input.fallback,
    temperature: input.temperature ?? 0.68,
    maxTokens: input.maxTokens ?? 240,
  })
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

async function loadAgentMemoryContext(
  supabase: SupabaseClient,
  userId: string,
  agentId: CouncilAgentId,
  excludeReply?: string | null,
): Promise<string> {
  let { data } = await supabase
    .from("agent_memories")
    .select("last_10_conversations")
    .eq("user_id", userId)
    .eq("agent_name", agentId)
    .maybeSingle()

  if (!data?.last_10_conversations) {
    const legacyName = LEGACY_COUNCIL_AGENT_NAME[agentId]
    if (legacyName) {
      const legacy = await supabase
        .from("agent_memories")
        .select("last_10_conversations")
        .eq("user_id", userId)
        .eq("agent_name", legacyName)
        .maybeSingle()
      data = legacy.data
    }
  }

  const conversations = Array.isArray(data?.last_10_conversations)
    ? (data.last_10_conversations as Array<{ user: string; agent: string }>)
    : []

  if (conversations.length === 0) return ""

  const normalizedExclude = excludeReply?.trim().toLowerCase()

  return [...conversations]
    .reverse()
    .slice(-5)
    .filter((turn) => {
      if (!normalizedExclude) return true
      return turn.agent.trim().toLowerCase() !== normalizedExclude
    })
    .map(
      (turn) =>
        `Trader: ${turn.user}\n${getCouncilAgent(agentId).name}: ${turn.agent}`,
    )
    .join("\n\n")
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
    const conversationAgent = session
      ? getStickyCouncilAgentFromTranscript(session.full_transcript)
      : null
    return {
      session,
      settings,
      isMorningWindow: isCouncilMorningWindow(),
      voiceConfigured: isCouncilVoiceOutputConfigured(),
      listenConfigured: isCouncilListenConfigured(),
      conversationAgent,
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
    const systemPrompt = buildCouncilAgentSystemPrompt(agentId, context, "briefing")
    const previousBriefing =
      newMessages.length > 0
        ? {
            agentName: getCouncilAgent(newMessages[newMessages.length - 1]!.agent as CouncilAgentId).name,
            content: newMessages[newMessages.length - 1]!.content,
          }
        : null
    const content = await generateAgentText({
      agentId,
      systemPrompt,
      userPrompt: buildCouncilBriefingUserPrompt(agentId, previousBriefing),
      fallback: fallbackAgentLine(agentId, context),
      temperature: 0.55,
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
  options?: {
    preferredAgent?: CouncilAgentId
    conversationAgent?: CouncilAgentId
  },
): Promise<CouncilRespondResponse> {
  const trimmed = message.trim()
  if (!trimmed) {
    throw new Error("Message is required")
  }

  const context = await loadCouncilAgentContext(supabase, userId, accountId)
  const existing = await getTodayCouncilSession(supabase, userId, accountId)
  const transcript = existing?.full_transcript ?? []
  const stickyAgent = getStickyCouncilAgentFromTranscript(transcript)
  const agentId = resolveCouncilAgentForMessage(trimmed, {
    preferredAgent: options?.preferredAgent,
    stickyAgent,
    conversationAgent: options?.conversationAgent,
  })

  const userEntry: CouncilTranscriptEntry = {
    id: randomUUID(),
    agent: "user",
    content: trimmed,
    createdAt: new Date().toISOString(),
  }

  const lastAgentReply = getLastAgentReplyInTranscript(transcript, agentId)
  const recentTranscript = buildRecentTranscriptLines(transcript, context.traderFirstName, 6)
  const agentMemory = await loadAgentMemoryContext(
    supabase,
    userId,
    agentId,
    lastAgentReply,
  ).catch(() => "")

  const pronounTarget = resolveCouncilPronounTarget(trimmed, transcript)
  const namedAgent = detectCouncilAgentByName(trimmed)
  const delegationTarget =
    pronounTarget ?? (namedAgent && isCouncilDelegationRequest(trimmed) ? namedAgent : null)

  const handoff = pickCouncilCrossAgentHandoff({
    question: trimmed,
    primaryAgent: agentId,
    forcedTarget: delegationTarget,
  })

  let reply: string
  const agentMessages: CouncilTranscriptEntry[] = []
  let lastReply: string
  let lastSpeaker: CouncilAgentId = agentId

  if (handoff) {
    const primaryName = getCouncilAgent(agentId).name
    const targetName = getCouncilAgent(handoff.targetAgent).name

    reply = await produceCouncilAgentReply({
      agentId,
      context,
      userPrompt: buildCouncilHandoffAskUserPrompt({
        primaryAgentName: primaryName,
        targetAgentName: targetName,
        topic: handoff.topic,
        question: trimmed,
        recentTranscript,
      }),
      fallback: buildHandoffAskFallback({
        primaryAgent: agentId,
        targetAgent: handoff.targetAgent,
        topic: handoff.topic,
      }),
      temperature: 0.55,
      maxTokens: 80,
    })

    const agentEntry: CouncilTranscriptEntry = {
      id: randomUUID(),
      agent: agentId,
      content: reply,
      createdAt: new Date().toISOString(),
    }
    agentMessages.push(agentEntry)

    const targetReply = await produceCouncilAgentReply({
      agentId: handoff.targetAgent,
      context,
      userPrompt: buildCouncilHandoffAnswerUserPrompt({
        primaryAgentName: primaryName,
        primaryHandoff: reply,
        targetAgentName: targetName,
        topic: handoff.topic,
        question: trimmed,
      }),
      fallback: buildHandoffAnswerFallback({
        targetAgent: handoff.targetAgent,
        topic: handoff.topic,
        context,
      }),
      temperature: 0.62,
      maxTokens: 160,
    })

    const targetEntry: CouncilTranscriptEntry = {
      id: randomUUID(),
      agent: handoff.targetAgent,
      content: targetReply,
      createdAt: new Date().toISOString(),
    }
    agentMessages.push(targetEntry)
    lastReply = targetReply
    lastSpeaker = handoff.targetAgent

    await appendAgentMemory(supabase, userId, handoff.targetAgent, trimmed, targetReply).catch(
      () => undefined,
    )
  } else {
    reply = await produceCouncilAgentReply({
      agentId,
      context,
      userPrompt: buildCouncilRespondUserPrompt({
        question: trimmed,
        recentTranscript,
        agentMemory,
        lastAgentReply,
        agentName: getCouncilAgent(agentId).name,
      }),
      fallback: buildConversationFallback({
        agentId,
        context,
        question: trimmed,
        lastReply: lastAgentReply,
      }),
    })

    const agentEntry: CouncilTranscriptEntry = {
      id: randomUUID(),
      agent: agentId,
      content: reply,
      createdAt: new Date().toISOString(),
    }
    agentMessages.push(agentEntry)
    lastReply = reply
    lastSpeaker = agentId
  }

  const agentEntry = agentMessages[0]!
  const workingTranscript = [...transcript, userEntry, agentEntry]
  const maxChimes = handoff
    ? 0
    : /what does the council|what do you all|everyone think|whole council|all of you|council think|ask the council|full council/i.test(
          trimmed,
        )
      ? 2
      : 1

  for (let index = 0; index < maxChimes; index += 1) {
    const chimeDecision = pickCouncilChimeInAgent({
      primaryAgent: lastSpeaker,
      question: trimmed,
      primaryReply: lastReply,
      context,
      excludeAgents: agentMessages.map((entry) => entry.agent as CouncilAgentId),
    })
    if (!chimeDecision || chimeDecision.agent === lastSpeaker) break

    const chimeReply = await produceCouncilAgentReply({
      agentId: chimeDecision.agent,
      context,
      userPrompt: buildCouncilChimeInUserPrompt({
        question: trimmed,
        primaryAgentName: getCouncilAgent(lastSpeaker).name,
        primaryReply: lastReply,
        chimeAgentName: getCouncilAgent(chimeDecision.agent).name,
        reason: chimeDecision.reason,
      }),
      fallback: buildChimeInFallback({
        chimeAgent: chimeDecision.agent,
        primaryAgent: lastSpeaker,
        primaryReply: lastReply,
      }),
      temperature: 0.62,
      maxTokens: 160,
    })

    const chimeInEntry: CouncilTranscriptEntry = {
      id: randomUUID(),
      agent: chimeDecision.agent,
      content: chimeReply,
      createdAt: new Date().toISOString(),
    }
    agentMessages.push(chimeInEntry)
    lastReply = chimeReply
    lastSpeaker = chimeDecision.agent
    await appendAgentMemory(supabase, userId, chimeDecision.agent, trimmed, chimeReply).catch(
      () => undefined,
    )
  }

  const session = await upsertTodaySession(supabase, userId, accountId, {
    full_transcript: [...workingTranscript, ...agentMessages.slice(1)],
    agents_spoken: [
      ...new Set([
        ...(existing?.agents_spoken ?? []),
        ...agentMessages.map((entry) => getCouncilAgent(entry.agent as CouncilAgentId).name),
      ]),
    ],
  })

  await appendAgentMemory(supabase, userId, agentId, trimmed, reply).catch(() => undefined)

  return {
    sessionId: session.id,
    agent: agentId,
    message: agentEntry,
    messages: agentMessages,
    chimeIn: agentMessages.length > 1 ? agentMessages[agentMessages.length - 1]! : null,
  }
}
