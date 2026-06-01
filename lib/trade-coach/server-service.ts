import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildCoachIntro,
  extractResponsesFromMessages,
  getNextQuestionKey,
  getQuestionByKey,
  isTradePlannerCoachHandoff,
  normalizeAnswer,
} from "@/lib/trade-coach/pre-trade-flow"
import { finalizeCoachChapterSession, loadCoachChapterContext } from "@/lib/coach-chapters/context-service"
import {
  analyzeChartVisionForContext,
  buildChartAnalysisMessages,
  normalizeChartAnalysis,
} from "@/lib/trade-coach/chart-analysis-engine"
import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import {
  mtfAnalysisToChartAnalysis,
} from "@/lib/coach/multi-timeframe-vision-engine"
import {
  analyzeMultiTimeframeWithVision,
  buildVisualAnalysisMessages,
} from "@/lib/coach/visual-mtf-engine"
import {
  canRunMtfAnalysis,
  countMtfScreenshots,
  getMtfScreenshotsFromSession,
  getMtfUrlField,
  hasMtfAnalysis,
  isMtfAnalysisResult,
  mergeMtfIntoContext,
  resolveSessionMtfAnalysis,
} from "@/lib/trade-coach/mtf-session"
import { hydrateCoachSessionFromWarRoom } from "@/lib/trade-coach/war-room-chart-seed"
import {
  buildPreTradeCompletionMessages,
  generatePreTradeAnalysis,
} from "@/lib/trade-coach/pre-trade-analysis"
import {
  buildCoachAnalysisBundle,
  enrichVyronisCoachResponseWithLlm,
} from "@/lib/coach/vyronis-coach-response"
import {
  evaluatePrecisionFlow,
  mapVerdictToShouldTakeTrade,
} from "@/lib/coach/precision-flow-engine"
import { buildVyronisCoachTraderContext } from "@/lib/coach/vyronis-coach-trader-context"
import { detectCoachRedFlags } from "@/lib/trade-coach/red-flags"
import {
  extractPreTradeResponses,
  generatePostTradeCoachFeedback,
  mergePlannedContext,
} from "@/lib/trade-coach/post-trade-analysis"
import type {
  CoachSessionHistoryItem,
  PlannedCoachSessionItem,
  PostTradeCoachInput,
  PreTradePlannedContext,
  TradeCoachFeedbackRecord,
  TradeCoachMessageRecord,
  TradeCoachSessionRecord,
  TradeCoachSessionWithMessages,
} from "@/lib/trade-coach/types"
import { buildPlannedCoachSessionItem } from "@/lib/trade-coach/planned-context"
import {
  buildTradeQualityInput,
  fetchQualityContext,
} from "@/lib/trade-coach/quality-context"
import {
  buildTradeQualityAnalytics,
  type TradeQualitySessionRow,
} from "@/lib/trade-coach/trade-quality-analytics"
import { computeTradeQuality } from "@/lib/trade-coach/trade-quality-engine"
import { DEFAULT_USER_SETTINGS, normalizeUserSettings } from "@/lib/user-settings"
import { buildPlaybookMatchMessages } from "@/lib/strategy/playbook-engine"
import { resolveCoachPlaybook } from "@/lib/strategy/server-service"

export class TradeCoachTableMissingError extends Error {
  constructor(message = "Trade coach tables are missing. Run supabase/trade-coach-migration.sql.") {
    super(message)
    this.name = "TradeCoachTableMissingError"
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

function throwIfMissing(error: { message?: string; code?: string } | null) {
  if (isMissingTableError(error)) {
    throw new TradeCoachTableMissingError()
  }
}

function getMaxRiskPerTrade(context: PreTradePlannedContext): number {
  return context.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade
}

export async function createPreTradeSession(
  supabase: SupabaseClient,
  userId: string,
  plannedContext: PreTradePlannedContext,
  accountId?: string | null,
): Promise<TradeCoachSessionWithMessages> {
  const maxRisk = getMaxRiskPerTrade(plannedContext)
  const contextWithRisk = { ...plannedContext, max_risk_per_trade: maxRisk }

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    planned_context: contextWithRisk,
    status: "in_progress",
  }
  if (accountId) insertPayload.account_id = accountId

  let weekChapter: number | null = null
  let intro = buildCoachIntro(contextWithRisk)
  if (accountId) {
    try {
      const chapterContext = await loadCoachChapterContext(supabase, userId, accountId)
      weekChapter = chapterContext.currentChapterNumber
      intro = `${chapterContext.openingMessage}\n\n${intro}`
      insertPayload.week_chapter = weekChapter
      insertPayload.session_type = "pre_trade"
    } catch {
      // Chapter tables optional until migrated
    }
  }

  const { data: session, error: sessionError } = await supabase
    .from("trade_coach_sessions")
    .insert(insertPayload)
    .select("*")
    .single()

  throwIfMissing(sessionError)
  if (sessionError || !session) {
    throw new Error(sessionError?.message || "Could not create coach session")
  }

  const seedMessages: Array<{
    session_id: string
    user_id: string
    role: "coach"
    question_key: string | null
    content: string
    step_index: number
  }> = [
    {
      session_id: session.id,
      user_id: userId,
      role: "coach",
      question_key: null,
      content: intro,
      step_index: 0,
    },
  ]

  const { data: messages, error: messagesError } = await supabase
    .from("trade_coach_messages")
    .insert(seedMessages)
    .select("*")
    .order("step_index", { ascending: true })

  throwIfMissing(messagesError)
  if (messagesError) {
    throw new Error(messagesError.message)
  }

  let hydrated: TradeCoachSessionWithMessages = {
    ...(session as TradeCoachSessionRecord),
    messages: (messages || []) as TradeCoachMessageRecord[],
  }

  if (contextWithRisk.pair?.trim()) {
    hydrated = await hydrateCoachSessionFromWarRoom(
      supabase,
      userId,
      hydrated,
      contextWithRisk.pair,
      submitCoachMtfScreenshot,
    )
  }

  const chartUrl = contextWithRisk.chart_url?.trim() || contextWithRisk.screenshot_url?.trim()
  const hasMtfCharts = countMtfScreenshots(getMtfScreenshotsFromSession(hydrated)) > 0
  if (!hasMtfCharts && isTradePlannerCoachHandoff(contextWithRisk) && chartUrl) {
    hydrated = await submitCoachMtfScreenshot(supabase, userId, hydrated.id, "m15", chartUrl)
    hydrated = await submitCoachMtfScreenshot(supabase, userId, hydrated.id, "h1", chartUrl)
  }

  return hydrated
}

export async function submitCoachChart(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  chartUrl: string,
  options?: { replace?: boolean },
): Promise<TradeCoachSessionWithMessages> {
  const session = await getCoachSession(supabase, userId, sessionId)
  if (!session) {
    throw new Error("Coach session not found")
  }
  if (session.status !== "in_progress") {
    throw new Error("Coach session is already completed")
  }
  const isReplace = options?.replace === true
  if (session.chart_url && !isReplace) {
    throw new Error("Chart already uploaded for this session")
  }

  const context = session.planned_context as PreTradePlannedContext
  const maxRisk = getMaxRiskPerTrade(context)
  const { vision, legacy: chartAnalysis } = await analyzeChartVisionForContext(chartUrl, {
    ...context,
    chart_url: chartUrl,
    screenshot_url: chartUrl,
  })
  const updatedContext: PreTradePlannedContext = {
    ...context,
    chart_url: chartUrl,
    screenshot_url: chartUrl,
    vision_score: vision.visionScore,
    chart_analysis: chartAnalysis,
  }

  const existingResponses = extractResponsesFromMessages(session.messages)
  const nextQuestionKey = getNextQuestionKey(
    updatedContext,
    existingResponses,
    maxRisk,
    chartUrl,
  )
  const nextQuestion = nextQuestionKey ? getQuestionByKey(nextQuestionKey) : null
  const shouldAskNextQuestion =
    Boolean(nextQuestion) && (!isReplace || Object.keys(existingResponses).length === 0)

  const maxStepIndex = session.messages.reduce(
    (max, message) => Math.max(max, message.step_index),
    0,
  )
  let stepIndex = maxStepIndex + 1

  const inserts: Array<{
    session_id: string
    user_id: string
    role: "coach" | "user"
    question_key: string | null
    content: string
    step_index: number
  }> = [
    {
      session_id: sessionId,
      user_id: userId,
      role: "user",
      question_key: null,
      content: isReplace ? "Chart screenshot replaced" : "Chart screenshot uploaded",
      step_index: stepIndex,
    },
  ]

  stepIndex += 1

  for (const message of buildChartAnalysisMessages(chartAnalysis)) {
    inserts.push({
      session_id: sessionId,
      user_id: userId,
      role: "coach",
      question_key: null,
      content: message,
      step_index: stepIndex,
    })
    stepIndex += 1
  }

  if (shouldAskNextQuestion && nextQuestion) {
    inserts.push({
      session_id: sessionId,
      user_id: userId,
      role: "coach",
      question_key: nextQuestion.key,
      content: nextQuestion.prompt,
      step_index: stepIndex,
    })
  }

  const { error: insertError } = await supabase.from("trade_coach_messages").insert(inserts)
  throwIfMissing(insertError)
  if (insertError) {
    throw new Error(insertError.message)
  }

  const updatePayload = {
    planned_context: updatedContext,
    chart_url: chartUrl,
    screenshot_url: chartUrl,
    chart_analysis: chartAnalysis,
    vision_score: vision.visionScore,
    updated_at: new Date().toISOString(),
  }

  const { error: updateError } = await supabase
    .from("trade_coach_sessions")
    .update(updatePayload)
    .eq("id", sessionId)
    .eq("user_id", userId)

  if (updateError && /column|schema cache/i.test(updateError.message)) {
    const { error: fallbackError } = await supabase
      .from("trade_coach_sessions")
      .update({
        planned_context: updatedContext,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", userId)

    throwIfMissing(fallbackError)
    if (fallbackError) {
      throw new Error(fallbackError.message)
    }
  } else {
    throwIfMissing(updateError)
    if (updateError) {
      throw new Error(updateError.message)
    }
  }

  const refreshed = await getCoachSession(supabase, userId, sessionId)
  if (!refreshed) {
    throw new Error("Could not reload coach session")
  }
  return refreshed
}

export async function removeCoachChart(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<TradeCoachSessionWithMessages> {
  const session = await getCoachSession(supabase, userId, sessionId)
  if (!session) {
    throw new Error("Coach session not found")
  }
  if (session.status !== "in_progress") {
    throw new Error("Coach session is already completed")
  }

  const context = session.planned_context as PreTradePlannedContext
  const updatedContext: PreTradePlannedContext = {
    ...context,
    chart_url: undefined,
    screenshot_url: undefined,
    vision_score: undefined,
    chart_analysis: undefined,
  }

  const updatePayload = {
    planned_context: updatedContext,
    chart_url: null,
    screenshot_url: null,
    chart_analysis: {},
    vision_score: null,
    updated_at: new Date().toISOString(),
  }

  const { error: updateError } = await supabase
    .from("trade_coach_sessions")
    .update(updatePayload)
    .eq("id", sessionId)
    .eq("user_id", userId)

  if (updateError && /column|schema cache/i.test(updateError.message)) {
    const { error: fallbackError } = await supabase
      .from("trade_coach_sessions")
      .update({
        planned_context: updatedContext,
        chart_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", userId)

    throwIfMissing(fallbackError)
    if (fallbackError) {
      throw new Error(fallbackError.message)
    }
  } else {
    throwIfMissing(updateError)
    if (updateError) {
      throw new Error(updateError.message)
    }
  }

  const refreshed = await getCoachSession(supabase, userId, sessionId)
  if (!refreshed) {
    throw new Error("Could not reload coach session")
  }
  return refreshed
}

export async function submitCoachMtfScreenshot(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  timeframe: CoachMtfTimeframe,
  chartUrl: string,
): Promise<TradeCoachSessionWithMessages> {
  const session = await getCoachSession(supabase, userId, sessionId)
  if (!session) throw new Error("Coach session not found")
  if (session.status !== "in_progress") throw new Error("Coach session is already completed")

  const urlField = getMtfUrlField(timeframe)
  const updatePayload: Record<string, unknown> = {
    [urlField]: chartUrl,
    updated_at: new Date().toISOString(),
  }

  if (timeframe === "m15" || !session.screenshot_url) {
    updatePayload.screenshot_url = chartUrl
    updatePayload.chart_url = chartUrl
  }

  const { error } = await supabase
    .from("trade_coach_sessions")
    .update(updatePayload)
    .eq("id", sessionId)
    .eq("user_id", userId)

  throwIfMissing(error)
  if (error) throw new Error(error.message)

  const refreshed = await getCoachSession(supabase, userId, sessionId)
  if (!refreshed) throw new Error("Could not reload coach session")
  return refreshed
}

export async function syncWarRoomChartsToCoachSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<TradeCoachSessionWithMessages> {
  const session = await getCoachSession(supabase, userId, sessionId)
  if (!session) throw new Error("Coach session not found")
  if (session.status !== "in_progress") throw new Error("Coach session is already completed")

  const pair = (session.planned_context as PreTradePlannedContext).pair?.trim()
  if (!pair) {
    throw new Error("Set this week's pair before syncing War Room charts.")
  }

  return hydrateCoachSessionFromWarRoom(
    supabase,
    userId,
    session,
    pair,
    submitCoachMtfScreenshot,
  )
}

export async function removeCoachMtfScreenshot(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  timeframe: CoachMtfTimeframe,
): Promise<TradeCoachSessionWithMessages> {
  const session = await getCoachSession(supabase, userId, sessionId)
  if (!session) throw new Error("Coach session not found")
  if (session.status !== "in_progress") throw new Error("Coach session is already completed")

  const urlField = getMtfUrlField(timeframe)
  const updatePayload: Record<string, unknown> = {
    [urlField]: null,
    mtf_analysis: {},
    chart_annotations: {},
    visual_analysis: {},
    vision_provider: null,
    vision_analyzed_at: null,
    bias_alignment_score: null,
    entry_confirmation_score: null,
    vision_score: null,
    chart_analysis: {},
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from("trade_coach_sessions")
    .update(updatePayload)
    .eq("id", sessionId)
    .eq("user_id", userId)

  throwIfMissing(error)
  if (error) throw new Error(error.message)

  const refreshed = await getCoachSession(supabase, userId, sessionId)
  if (!refreshed) throw new Error("Could not reload coach session")
  return refreshed
}

export async function runCoachMtfAnalysis(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<TradeCoachSessionWithMessages> {
  const session = await getCoachSession(supabase, userId, sessionId)
  if (!session) throw new Error("Coach session not found")
  if (session.status !== "in_progress") throw new Error("Coach session is already completed")

  const context = session.planned_context as PreTradePlannedContext
  const maxRisk = getMaxRiskPerTrade(context)
  const screenshots = getMtfScreenshotsFromSession(session)

  if (!canRunMtfAnalysis(screenshots)) {
    throw new Error("Upload at least one chart before running MTF analysis.")
  }

  const playbook = await resolveCoachPlaybook(supabase, userId, context)
  const visionResult = await analyzeMultiTimeframeWithVision({
    screenshots,
    context,
    playbook,
  })
  const mtfAnalysis = visionResult.mtfAnalysis
  const visualAnalysis = visionResult.visualAnalysis
  const chartAnalysis = visionResult.chartAnalysis
  const updatedContext = mergeMtfIntoContext(context, session, mtfAnalysis)
  updatedContext.chart_analysis = chartAnalysis
  updatedContext.visual_analysis = visualAnalysis
  updatedContext.chart_annotations = visualAnalysis.chartAnnotations

  if (playbook && mtfAnalysis.playbookMatch) {
    updatedContext.strategy_playbook_id = playbook.id
    updatedContext.strategy_name = playbook.strategy_name
    updatedContext.playbook_match = mtfAnalysis.playbookMatch
  } else if (playbook) {
    updatedContext.strategy_playbook_id = playbook.id
    updatedContext.strategy_name = playbook.strategy_name
  }

  const existingResponses = extractResponsesFromMessages(session.messages)
  const primaryUrl =
    screenshots.m15 || screenshots.h1 || screenshots.h4 || screenshots.daily || screenshots.weekly || null

  const nextQuestionKey = getNextQuestionKey(
    updatedContext,
    existingResponses,
    maxRisk,
    primaryUrl,
  )
  const nextQuestion = nextQuestionKey ? getQuestionByKey(nextQuestionKey) : null
  const coachAlreadyAskedNext =
    Boolean(nextQuestionKey) &&
    session.messages.some(
      (message) => message.role === "coach" && message.question_key === nextQuestionKey,
    )
  const shouldAskNextQuestion = Boolean(nextQuestion) && !coachAlreadyAskedNext

  const maxStepIndex = session.messages.reduce(
    (max, message) => Math.max(max, message.step_index),
    0,
  )
  let stepIndex = maxStepIndex + 1

  const inserts: Array<{
    session_id: string
    user_id: string
    role: "coach" | "user"
    question_key: string | null
    content: string
    step_index: number
  }> = [
    {
      session_id: sessionId,
      user_id: userId,
      role: "user",
      question_key: null,
      content: `Multi-timeframe analysis run (${mtfAnalysis.chartsProvided}/5 charts)`,
      step_index: stepIndex,
    },
  ]

  stepIndex += 1

  for (const message of buildVisualAnalysisMessages(visualAnalysis)) {
    inserts.push({
      session_id: sessionId,
      user_id: userId,
      role: "coach",
      question_key: null,
      content: message,
      step_index: stepIndex,
    })
    stepIndex += 1
  }

  if (mtfAnalysis.playbookMatch) {
    for (const message of buildPlaybookMatchMessages(mtfAnalysis.playbookMatch)) {
      inserts.push({
        session_id: sessionId,
        user_id: userId,
        role: "coach",
        question_key: null,
        content: message,
        step_index: stepIndex,
      })
      stepIndex += 1
    }
  }

  if (shouldAskNextQuestion && nextQuestion) {
    inserts.push({
      session_id: sessionId,
      user_id: userId,
      role: "coach",
      question_key: nextQuestion.key,
      content: nextQuestion.prompt,
      step_index: stepIndex,
    })
  }

  const { error: insertError } = await supabase.from("trade_coach_messages").insert(inserts)
  throwIfMissing(insertError)
  if (insertError) throw new Error(insertError.message)

  const updatePayload = {
    planned_context: updatedContext,
    mtf_analysis: mtfAnalysis,
    visual_analysis: visualAnalysis,
    chart_annotations: visualAnalysis.chartAnnotations ?? {},
    vision_provider: visualAnalysis.provider,
    vision_analyzed_at: visualAnalysis.analyzedAt,
    chart_analysis: chartAnalysis,
    bias_alignment_score: mtfAnalysis.bias.biasAlignmentScore,
    entry_confirmation_score: mtfAnalysis.entry.entryConfirmationScore,
    vision_score: mtfAnalysis.visionScore,
    confidence_score: visualAnalysis.aggregate.confidenceScore,
    quality_score: visualAnalysis.aggregate.tradeQualityScore,
    quality_grade: visualAnalysis.aggregate.tradeQualityGrade,
    recommendation: visualAnalysis.aggregate.recommendation,
    warnings: visualAnalysis.aggregate.warnings,
    strengths: visualAnalysis.aggregate.strengths,
    screenshot_url: primaryUrl,
    chart_url: primaryUrl,
    updated_at: new Date().toISOString(),
  }

  const { error: updateError } = await supabase
    .from("trade_coach_sessions")
    .update(updatePayload)
    .eq("id", sessionId)
    .eq("user_id", userId)

  if (updateError && /column|schema cache/i.test(updateError.message)) {
    const { error: fallbackError } = await supabase
      .from("trade_coach_sessions")
      .update({
        planned_context: updatedContext,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", userId)
    throwIfMissing(fallbackError)
    if (fallbackError) throw new Error(fallbackError.message)
  } else {
    throwIfMissing(updateError)
    if (updateError) throw new Error(updateError.message)
  }

  const refreshed = await getCoachSession(supabase, userId, sessionId)
  if (!refreshed) throw new Error("Could not reload coach session")
  return refreshed
}

export async function updateCoachSessionPlannedContext(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  patch: Partial<
    Pick<
      PreTradePlannedContext,
      | "strategy_playbook_id"
      | "strategy_name"
      | "pair"
      | "direction"
      | "higher_timeframe"
      | "entry_timeframe"
      | "confirmation_timeframe"
    >
  >,
): Promise<TradeCoachSessionWithMessages> {
  const session = await getCoachSession(supabase, userId, sessionId)
  if (!session) throw new Error("Coach session not found")
  if (session.status !== "in_progress") throw new Error("Coach session is already completed")

  const updatedContext: PreTradePlannedContext = {
    ...session.planned_context,
    ...patch,
  }

  const { error } = await supabase
    .from("trade_coach_sessions")
    .update({
      planned_context: updatedContext,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)

  throwIfMissing(error)
  if (error) throw new Error(error.message)

  const refreshed = await getCoachSession(supabase, userId, sessionId)
  if (!refreshed) throw new Error("Could not reload coach session")
  return refreshed
}

export async function deleteCoachSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<void> {
  const session = await getCoachSession(supabase, userId, sessionId)
  if (!session) throw new Error("Coach session not found")

  if (session.trade_id) {
    throw new Error("Cannot delete a coach session that is linked to a trade.")
  }

  if (session.status === "linked") {
    throw new Error("Cannot delete a linked coach session.")
  }

  const { data, error } = await supabase
    .from("trade_coach_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId)
    .is("trade_id", null)
    .in("status", ["in_progress", "completed"])
    .select("id")

  throwIfMissing(error)
  if (error) throw new Error(error.message)
  if (!data?.length) {
    throw new Error("Could not delete coach session.")
  }
}

export async function getCoachSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<TradeCoachSessionWithMessages | null> {
  const { data: session, error: sessionError } = await supabase
    .from("trade_coach_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle()

  throwIfMissing(sessionError)
  if (sessionError || !session) return null

  const { data: messages, error: messagesError } = await supabase
    .from("trade_coach_messages")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("step_index", { ascending: true })
    .order("created_at", { ascending: true })

  throwIfMissing(messagesError)
  if (messagesError) {
    throw new Error(messagesError.message)
  }

  const record = session as TradeCoachSessionRecord
  const plannedContext = (record.planned_context || {}) as PreTradePlannedContext
  const screenshots = getMtfScreenshotsFromSession(record)
  const mtfAnalysis = resolveSessionMtfAnalysis(record)

  const chartUrl =
    record.screenshot_url ||
    record.chart_url ||
    screenshots.m15 ||
    screenshots.h1 ||
    screenshots.h4 ||
    screenshots.daily ||
    screenshots.weekly ||
    plannedContext.screenshot_url ||
    plannedContext.chart_url ||
    null

  const rawAnalysis = record.chart_analysis || plannedContext.chart_analysis
  let chartAnalysis = normalizeChartAnalysis(rawAnalysis, {
    ...plannedContext,
    chart_url: chartUrl || undefined,
    screenshot_url: chartUrl || undefined,
  })

  if (mtfAnalysis && !chartAnalysis?.mtf) {
    chartAnalysis = mtfAnalysisToChartAnalysis(mtfAnalysis, plannedContext)
  } else if (chartUrl && !chartAnalysis && !mtfAnalysis) {
    const { legacy } = await analyzeChartVisionForContext(chartUrl, {
      ...plannedContext,
      chart_url: chartUrl,
      screenshot_url: chartUrl,
    })
    chartAnalysis = legacy
  }

  const normalizedContext = mergeMtfIntoContext(
    plannedContext,
    record,
    mtfAnalysis,
  )
  if (chartAnalysis) {
    normalizedContext.chart_analysis = chartAnalysis
  }

  return {
    ...record,
    planned_context: normalizedContext,
    chart_url: chartUrl,
    screenshot_url: chartUrl,
    weekly_screenshot_url: record.weekly_screenshot_url ?? screenshots.weekly ?? null,
    daily_screenshot_url: record.daily_screenshot_url ?? screenshots.daily ?? null,
    h4_screenshot_url: record.h4_screenshot_url ?? screenshots.h4 ?? null,
    h1_screenshot_url: record.h1_screenshot_url ?? screenshots.h1 ?? null,
    m15_screenshot_url: record.m15_screenshot_url ?? screenshots.m15 ?? null,
    mtf_analysis: mtfAnalysis,
    bias_alignment_score:
      record.bias_alignment_score ?? mtfAnalysis?.bias.biasAlignmentScore ?? null,
    entry_confirmation_score:
      record.entry_confirmation_score ?? mtfAnalysis?.entry.entryConfirmationScore ?? null,
    vision_score:
      record.vision_score ??
      mtfAnalysis?.visionScore ??
      chartAnalysis?.vision?.visionScore ??
      chartAnalysis?.overallScore ??
      null,
    chart_analysis: chartAnalysis,
    messages: (messages || []) as TradeCoachMessageRecord[],
  }
}

export async function submitPreTradeAnswer(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  questionKey: string,
  answer: string,
): Promise<TradeCoachSessionWithMessages> {
  const session = await getCoachSession(supabase, userId, sessionId)
  if (!session) {
    throw new Error("Coach session not found")
  }
  if (session.status !== "in_progress") {
    throw new Error("Coach session is already completed")
  }

  const question = getQuestionByKey(questionKey)
  if (!question) {
    throw new Error("Unknown coach question")
  }

  const normalizedAnswer = normalizeAnswer(question, answer)
  const context = session.planned_context as PreTradePlannedContext
  const maxRisk = getMaxRiskPerTrade(context)
  const existingResponses = extractResponsesFromMessages(session.messages)
  const responses = { ...existingResponses, [questionKey]: normalizedAnswer }

  const userMessages = session.messages.filter((item) => item.role === "user")
  let stepIndex = userMessages.length * 2 + 2

  const inserts: Array<{
    session_id: string
    user_id: string
    role: "coach" | "user"
    question_key: string | null
    content: string
    step_index: number
  }> = [
    {
      session_id: sessionId,
      user_id: userId,
      role: "user",
      question_key: questionKey,
      content: normalizedAnswer,
      step_index: stepIndex,
    },
  ]

  stepIndex += 1

  const redFlags = detectCoachRedFlags(context, responses, maxRisk)
  const newFlags = redFlags.filter(
    (flag) =>
      !session.messages.some((message) =>
        message.content.includes(flag.message.slice(0, 24)),
      ),
  )

  for (const flag of newFlags.slice(0, 2)) {
    inserts.push({
      session_id: sessionId,
      user_id: userId,
      role: "coach",
      question_key: null,
      content: `Red flag — ${flag.message}`,
      step_index: stepIndex,
    })
    stepIndex += 1
  }

  const nextQuestionKey = getNextQuestionKey(
    context,
    responses,
    maxRisk,
    session.chart_url,
    session,
  )
  let nextStatus: TradeCoachSessionRecord["status"] = "in_progress"
  let updatedContext: PreTradePlannedContext = mergeMtfIntoContext(
    context,
    session,
    isMtfAnalysisResult(session.mtf_analysis) ? session.mtf_analysis : null,
  )
  if (session.chart_analysis) {
    updatedContext.chart_analysis =
      normalizeChartAnalysis(session.chart_analysis, updatedContext) || undefined
  }

  if (nextQuestionKey) {
    const nextQuestion = getQuestionByKey(nextQuestionKey)
    if (!nextQuestion) {
      throw new Error("Could not resolve next coach question")
    }
    inserts.push({
      session_id: sessionId,
      user_id: userId,
      role: "coach",
      question_key: nextQuestion.key,
      content: nextQuestion.prompt,
      step_index: stepIndex,
    })
  } else {
    const { historicalTrades, patternMemory } = await fetchQualityContext(
      supabase,
      userId,
      maxRisk,
    )

    const { data: settingsRow } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    const settings = settingsRow
      ? normalizeUserSettings(settingsRow)
      : { ...DEFAULT_USER_SETTINGS }

    const precisionFlow = evaluatePrecisionFlow({
      context: updatedContext,
      responses,
      historicalTrades: historicalTrades as unknown as import("@/lib/trade-risk-guard").TradeRiskGuardHistoryTrade[],
      settings,
      startingBalance: settings.starting_balance,
    })

    let vyronisCoach = buildCoachAnalysisBundle({
      precisionFlow,
      context: updatedContext,
      responses,
      historicalTrades: historicalTrades as unknown as import("@/lib/trade-risk-guard").TradeRiskGuardHistoryTrade[],
      settings,
      patternMemory,
      startingBalance: settings.starting_balance,
    })

    const trader = buildVyronisCoachTraderContext({
      settings,
      historicalTrades: historicalTrades as unknown as import("@/lib/trade-risk-guard").TradeRiskGuardHistoryTrade[],
      patternMemory,
    })

    vyronisCoach = await enrichVyronisCoachResponseWithLlm({
      base: vyronisCoach,
      precisionFlow,
      context: updatedContext,
      trader,
    })

    const analysis = generatePreTradeAnalysis(updatedContext, responses, maxRisk)
    const tradeQuality = computeTradeQuality(
      buildTradeQualityInput(updatedContext, responses, maxRisk, historicalTrades, patternMemory),
    )
    updatedContext = {
      ...updatedContext,
      coach_analysis: {
        ...analysis,
        confidenceScore: vyronisCoach.confidence,
        shouldTakeTrade: mapVerdictToShouldTakeTrade(vyronisCoach.verdict),
        summary: vyronisCoach.summary,
        insights: [...vyronisCoach.why_it_passes, ...vyronisCoach.warnings].slice(0, 6),
        tradeQuality,
        precisionFlow,
        vyronisCoach,
      },
    }

    for (const message of buildPreTradeCompletionMessages(updatedContext.coach_analysis!)) {
      inserts.push({
        session_id: sessionId,
        user_id: userId,
        role: "coach",
        question_key: null,
        content: message,
        step_index: stepIndex,
      })
      stepIndex += 1
    }
    nextStatus = "completed"
  }

  const { error: insertError } = await supabase.from("trade_coach_messages").insert(inserts)
  throwIfMissing(insertError)
  if (insertError) {
    throw new Error(insertError.message)
  }

  const { error: updateError } = await supabase
    .from("trade_coach_sessions")
    .update({
      status: nextStatus,
      planned_context: updatedContext,
      quality_score: updatedContext.coach_analysis?.tradeQuality?.score ?? null,
      quality_grade: updatedContext.coach_analysis?.tradeQuality?.grade ?? null,
      recommendation: updatedContext.coach_analysis?.tradeQuality?.recommendation ?? null,
      confidence_score:
        updatedContext.coach_analysis?.tradeQuality?.confidence ??
        updatedContext.coach_analysis?.confidenceScore ??
        null,
      score_breakdown: updatedContext.coach_analysis?.tradeQuality?.breakdown ?? {},
      warnings: updatedContext.coach_analysis?.tradeQuality?.warnings ?? [],
      strengths: updatedContext.coach_analysis?.tradeQuality?.strengths ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)

  if (updateError && /column|schema cache/i.test(updateError.message)) {
    const { error: fallbackError } = await supabase
      .from("trade_coach_sessions")
      .update({
        status: nextStatus,
        planned_context: updatedContext,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", userId)

    throwIfMissing(fallbackError)
    if (fallbackError) {
      throw new Error(fallbackError.message)
    }
  } else {
    throwIfMissing(updateError)
    if (updateError) {
      throw new Error(updateError.message)
    }
  }

  const refreshed = await getCoachSession(supabase, userId, sessionId)
  if (!refreshed) {
    throw new Error("Could not reload coach session")
  }

  if (nextStatus === "completed") {
    const linkedAccountId = refreshed.account_id ?? null
    if (linkedAccountId) {
      const chapterContext = await loadCoachChapterContext(
        supabase,
        userId,
        linkedAccountId,
      ).catch(() => null)
      if (chapterContext) {
        await finalizeCoachChapterSession(
          supabase,
          userId,
          refreshed,
          chapterContext.currentChapterNumber,
        ).catch(() => undefined)
      }
    }
  }

  return refreshed
}

export async function linkCoachSessionToTrade(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  tradeId: string,
): Promise<TradeCoachSessionRecord> {
  const { data, error } = await supabase
    .from("trade_coach_sessions")
    .update({
      trade_id: tradeId,
      status: "linked",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("*")
    .single()

  throwIfMissing(error)
  if (error || !data) {
    throw new Error(error?.message || "Could not link coach session")
  }

  return data as TradeCoachSessionRecord
}

export async function getLinkedSessionForTrade(
  supabase: SupabaseClient,
  userId: string,
  tradeId: string,
): Promise<TradeCoachSessionWithMessages | null> {
  const { data: session, error } = await supabase
    .from("trade_coach_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("trade_id", tradeId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  throwIfMissing(error)
  if (error || !session) return null

  return getCoachSession(supabase, userId, session.id)
}

export async function generateAndSaveCoachFeedback(
  supabase: SupabaseClient,
  userId: string,
  tradeId: string,
  maxRiskPerTrade: number,
): Promise<TradeCoachFeedbackRecord> {
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("*")
    .eq("id", tradeId)
    .eq("user_id", userId)
    .maybeSingle()

  if (tradeError || !trade) {
    throw new Error(tradeError?.message || "Trade not found")
  }

  const linkedSession = await getLinkedSessionForTrade(supabase, userId, tradeId)
  const preTradeResponses = linkedSession
    ? extractPreTradeResponses(linkedSession.messages)
    : {}
  const plannedContext = mergePlannedContext(
    linkedSession?.planned_context || {},
    {
      pair: trade.pair,
      direction: trade.direction,
      setup: trade.setup,
      strategy_name: trade.strategy_name,
      risk_percent: trade.risk_percent?.toString(),
      session: trade.session,
      emotion: trade.emotion,
      rule_followed: trade.rule_followed ?? undefined,
      stop_loss: trade.stop_loss?.toString(),
      take_profit: trade.take_profit?.toString(),
      confirmation_signal: trade.confirmation_signal,
      max_risk_per_trade: maxRiskPerTrade,
    },
  )

  const input: PostTradeCoachInput = {
    trade: {
      id: String(trade.id),
      pair: trade.pair,
      direction: trade.direction,
      result: trade.result,
      pnl: trade.pnl,
      emotion: trade.emotion,
      emotion_after: trade.emotion_after,
      setup: trade.setup,
      strategy_name: trade.strategy_name,
      risk_percent: trade.risk_percent,
      rule_followed: trade.rule_followed,
      session: trade.session,
      trade_date: trade.trade_date,
      created_at: trade.created_at,
      confirmation_signal: trade.confirmation_signal,
      trade_notes: trade.trade_notes,
      mistake_tags: trade.mistake_tags,
      entry_price: trade.entry_price,
      stop_loss: trade.stop_loss,
      take_profit: trade.take_profit,
      risk_reward: trade.risk_reward,
    },
    preTradeResponses,
    plannedContext,
    maxRiskPerTrade,
  }

  const analysis = generatePostTradeCoachFeedback(input)

  const payload = {
    user_id: userId,
    session_id: linkedSession?.id ?? null,
    trade_id: tradeId,
    planned_vs_actual: analysis.plannedVsActual,
    discipline_analysis: {
      ...analysis.disciplineAnalysis,
      coachingInsights: analysis.coachingInsights,
    },
    coaching_summary: analysis.coachingSummary,
    feedback_points: analysis.feedbackPoints,
    discipline_score: analysis.disciplineScore,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("trade_coach_feedback")
    .upsert(payload, { onConflict: "trade_id" })
    .select("*")
    .single()

  throwIfMissing(error)
  if (error || !data) {
    throw new Error(error?.message || "Could not save coach feedback")
  }

  return data as TradeCoachFeedbackRecord
}

export async function getCoachFeedbackForTrade(
  supabase: SupabaseClient,
  userId: string,
  tradeId: string,
): Promise<TradeCoachFeedbackRecord | null> {
  const { data, error } = await supabase
    .from("trade_coach_feedback")
    .select("*")
    .eq("user_id", userId)
    .eq("trade_id", tradeId)
    .maybeSingle()

  throwIfMissing(error)
  if (error) return null
  return (data as TradeCoachFeedbackRecord) || null
}

export async function getPendingCoachSession(
  supabase: SupabaseClient,
  userId: string,
): Promise<TradeCoachSessionRecord | null> {
  const { data, error } = await supabase
    .from("trade_coach_sessions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["in_progress", "completed"])
    .is("trade_id", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  throwIfMissing(error)
  if (error) return null
  return (data as TradeCoachSessionRecord) || null
}

export async function listPlannedCoachSessions(
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
  accountId?: string | null,
  legacyAccountId?: string | null,
): Promise<PlannedCoachSessionItem[]> {
  let query = supabase
    .from("trade_coach_sessions")
    .select("id, status, planned_context, created_at, updated_at, account_id")
    .eq("user_id", userId)
    .is("trade_id", null)
    .in("status", ["in_progress", "completed"])
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (accountId) {
    query = query.or(
      legacyAccountId && accountId === legacyAccountId
        ? `account_id.eq.${accountId},account_id.is.null`
        : `account_id.eq.${accountId}`,
    )
  }

  const { data: sessions, error } = await query

  throwIfMissing(error)
  if (error || !sessions || sessions.length === 0) return []

  const sessionIds = sessions.map((session) => session.id)
  const { data: messages, error: messagesError } = await supabase
    .from("trade_coach_messages")
    .select("session_id, role, question_key, content")
    .eq("user_id", userId)
    .in("session_id", sessionIds)

  throwIfMissing(messagesError)
  if (messagesError) return []

  const responsesBySession = new Map<string, Record<string, string>>()
  for (const message of messages || []) {
    if (message.role !== "user" || !message.question_key) continue
    const existing = responsesBySession.get(message.session_id) || {}
    existing[message.question_key] = message.content
    responsesBySession.set(message.session_id, existing)
  }

  return sessions
    .map((session) =>
      buildPlannedCoachSessionItem(
        {
          id: session.id,
          status: session.status,
          planned_context: (session.planned_context || {}) as PreTradePlannedContext,
          created_at: session.created_at,
          updated_at: session.updated_at,
        },
        responsesBySession.get(session.id) || {},
      ),
    )
    .sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
}

export async function listCoachSessionHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<CoachSessionHistoryItem[]> {
  const { data: sessions, error } = await supabase
    .from("trade_coach_sessions")
    .select("id, status, trade_id, planned_context, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit)

  throwIfMissing(error)
  if (error || !sessions) return []

  const tradeIds = sessions
    .map((session) => session.trade_id)
    .filter((id): id is string | number => id !== null)

  let tradesById = new Map<string, { result: string }>()
  if (tradeIds.length > 0) {
    const { data: trades } = await supabase
      .from("trades")
      .select("id, result")
      .eq("user_id", userId)
      .in("id", tradeIds)

    tradesById = new Map(
      (trades || []).map((trade) => [String(trade.id), { result: trade.result }]),
    )
  }

  let feedbackByTradeId = new Map<string, number>()
  if (tradeIds.length > 0) {
    const { data: feedbackRows } = await supabase
      .from("trade_coach_feedback")
      .select("trade_id, discipline_score")
      .eq("user_id", userId)
      .in("trade_id", tradeIds)

    feedbackByTradeId = new Map(
      (feedbackRows || []).map((row) => [String(row.trade_id), row.discipline_score]),
    )
  }

  return sessions.map((session) => {
    const context = (session.planned_context || {}) as PreTradePlannedContext
    const tradeId = session.trade_id ? String(session.trade_id) : null
    return {
      id: session.id,
      status: session.status,
      trade_id: tradeId,
      pair: context.pair ?? null,
      direction: context.direction ?? null,
      confidence_score: context.coach_analysis?.confidenceScore ?? null,
      should_take_trade: context.coach_analysis?.shouldTakeTrade ?? null,
      trade_result: tradeId ? tradesById.get(tradeId)?.result ?? null : null,
      discipline_score: tradeId ? feedbackByTradeId.get(tradeId) ?? null : null,
      created_at: session.created_at,
      updated_at: session.updated_at,
    }
  })
}

export async function recordQualityOverride(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<TradeCoachSessionRecord> {
  const { data, error } = await supabase
    .from("trade_coach_sessions")
    .update({
      quality_override: true,
      quality_override_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("*")
    .single()

  throwIfMissing(error)
  if (error || !data) {
    throw new Error(error?.message || "Could not record quality override")
  }

  return data as TradeCoachSessionRecord
}

export async function getTradeQualityAnalytics(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data: sessions, error } = await supabase
    .from("trade_coach_sessions")
    .select("id, trade_id, quality_score, quality_grade, recommendation, confidence_score")
    .eq("user_id", userId)
    .not("quality_score", "is", null)
    .order("updated_at", { ascending: false })
    .limit(100)

  if (error && isMissingTableError(error)) {
    return buildTradeQualityAnalytics([])
  }
  throwIfMissing(error)
  if (error || !sessions) {
    return buildTradeQualityAnalytics([])
  }

  const tradeIds = sessions
    .map((session) => session.trade_id)
    .filter((id): id is string | number => id !== null)

  let tradesById = new Map<string, { result: string }>()
  let feedbackByTradeId = new Map<string, number>()

  if (tradeIds.length > 0) {
    const [{ data: trades }, { data: feedbackRows }] = await Promise.all([
      supabase.from("trades").select("id, result").eq("user_id", userId).in("id", tradeIds),
      supabase
        .from("trade_coach_feedback")
        .select("trade_id, discipline_score")
        .eq("user_id", userId)
        .in("trade_id", tradeIds),
    ])

    tradesById = new Map(
      (trades || []).map((trade) => [String(trade.id), { result: trade.result }]),
    )
    feedbackByTradeId = new Map(
      (feedbackRows || []).map((row) => [String(row.trade_id), row.discipline_score]),
    )
  }

  const rows: TradeQualitySessionRow[] = sessions.map((session) => {
    const tradeId = session.trade_id ? String(session.trade_id) : null
    return {
      id: session.id,
      trade_id: tradeId,
      quality_score: session.quality_score,
      quality_grade: session.quality_grade,
      recommendation: session.recommendation,
      confidence_score: session.confidence_score,
      discipline_score: tradeId ? feedbackByTradeId.get(tradeId) ?? null : null,
      trade_result: tradeId ? tradesById.get(tradeId)?.result ?? null : null,
    }
  })

  return buildTradeQualityAnalytics(rows)
}

export async function getLinkedCoachSessionByTradeId(
  supabase: SupabaseClient,
  userId: string,
  tradeId: string,
): Promise<TradeCoachSessionRecord | null> {
  const { data, error } = await supabase
    .from("trade_coach_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("trade_id", tradeId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  throwIfMissing(error)
  if (error || !data) return null
  return data as TradeCoachSessionRecord
}
