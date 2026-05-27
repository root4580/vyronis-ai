import type { MtfAnalysisResult } from "@/lib/coach/mtf-types"
import { countMtfScreenshots, getMtfScreenshotsFromSession, hasMtfAnalysis, resolveSessionMtfAnalysis } from "@/lib/trade-coach/mtf-session"
import type {
  PreTradePlannedContext,
  PreTradeQuestion,
  TradeCoachSessionRecord,
} from "@/lib/trade-coach/types"

const QUESTION_BANK: Record<string, PreTradeQuestion> = {
  emotional_state: {
    key: "emotional_state",
    prompt: "How are you feeling right now before entering?",
    type: "select",
    options: ["Calm", "Confident", "Disciplined", "Anxious", "FOMO", "Revenge", "Euphoric", "Fearful"],
    required: true,
  },
  planned_risk: {
    key: "planned_risk",
    prompt: "How much are you risking on this trade (% of account)?",
    placeholder: "e.g. 0.5%",
    type: "text",
    required: true,
  },
  rule_check: {
    key: "rule_check",
    prompt: "Are you following your trading rules for this entry?",
    type: "boolean",
    required: true,
  },
}

const BASE_FLOW = ["emotional_state", "planned_risk", "rule_check"] as const

function parsePercent(value: string | undefined): number | null {
  if (!value) return null
  const parsed = parseFloat(value.replace("%", "").trim())
  return Number.isFinite(parsed) ? parsed : null
}

export function hasChartUploaded(
  context: PreTradePlannedContext,
  chartUrl?: string | null,
  session?: TradeCoachSessionRecord | null,
): boolean {
  if (session && hasMtfAnalysis(session)) return true
  if (context.mtf_analysis) return true
  if (session) {
    return countMtfScreenshots(getMtfScreenshotsFromSession(session)) > 0
  }
  return Boolean(chartUrl || context.chart_url || context.screenshot_url)
}

export function isMtfAnalysisComplete(
  session?: Pick<
    TradeCoachSessionRecord,
    | "mtf_analysis"
    | "planned_context"
    | "chart_analysis"
    | "bias_alignment_score"
    | "entry_confirmation_score"
    | "vision_score"
    | "recommendation"
  > | null,
): boolean {
  if (!session) return false
  return resolveSessionMtfAnalysis(session) !== null
}

export function getQuestionByKey(key: string): PreTradeQuestion | null {
  return QUESTION_BANK[key] ?? null
}

export function getAnsweredKeys(
  messages: Array<{ role: string; question_key: string | null }>,
): Set<string> {
  const answered = new Set<string>()
  for (const message of messages) {
    if (message.role === "user" && message.question_key) {
      answered.add(message.question_key)
    }
  }
  return answered
}

export function extractResponsesFromMessages(
  messages: Array<{ role: string; question_key: string | null; content: string }>,
): Record<string, string> {
  const responses: Record<string, string> = {}
  for (const message of messages) {
    if (message.role === "user" && message.question_key) {
      responses[message.question_key] = message.content
    }
  }
  return responses
}

export function getNextQuestionKey(
  context: PreTradePlannedContext,
  responses: Record<string, string>,
  maxRiskPerTrade: number,
  chartUrl?: string | null,
): string | null {
  if (!isMtfAnalysisComplete({ planned_context: context, mtf_analysis: context.mtf_analysis ?? null })) {
    return null
  }

  const answered = new Set(Object.keys(responses))
  for (const baseKey of BASE_FLOW) {
    if (!answered.has(baseKey)) {
      return baseKey
    }
  }
  return null
}

export function getActiveQuestionFromSession(
  messages: Array<{ role: string; question_key: string | null; content: string }>,
  context: PreTradePlannedContext,
  chartUrl?: string | null,
): { key: string; prompt: string } | null {
  if (!isMtfAnalysisComplete({ planned_context: context, mtf_analysis: context.mtf_analysis ?? null })) {
    return null
  }

  const answered = getAnsweredKeys(messages)
  const coachQuestions = messages.filter(
    (message) => message.role === "coach" && message.question_key,
  )

  for (let index = coachQuestions.length - 1; index >= 0; index -= 1) {
    const key = coachQuestions[index].question_key as string
    if (!answered.has(key)) {
      const question = getQuestionByKey(key)
      if (question) {
        return { key, prompt: coachQuestions[index].content || question.prompt }
      }
    }
  }

  return null
}

export function buildCoachIntro(context: PreTradePlannedContext): string {
  if (context.signal_source === "tradingview") {
    const pair = context.pair || "your pair"
    const direction = context.direction || "setup"
    const strategy = context.strategy_name ? ` (${context.strategy_name})` : ""
    const score = context.coach_analysis?.confidenceScore
    const rec = context.coach_analysis?.shouldTakeTrade
    const scoreLine =
      score != null
        ? ` Vyronis scored this alert ${score}/100${rec ? ` — ${rec === "yes" ? "TAKE" : rec === "no" ? "SKIP" : "CAUTION"}` : ""}.`
        : ""
    return `TradingView alert received: ${pair} ${direction}${strategy}.${scoreLine} Click Open Coach when you're ready — this plan is saved in Planned Trades. No orders were placed.`
  }

  const pair = context.pair || "your pair"
  const direction = context.direction || "your direction"
  return `Multi-timeframe check-in for ${pair} ${direction}. Upload Weekly, Daily, H4 bias charts plus H1 setup and M15 entry screenshots. I'll score HTF alignment and entry confirmation, then ask 2-3 quick emotion/risk questions.`
}

export function estimateQuestionCount(): number {
  return BASE_FLOW.length
}

export function normalizeAnswer(question: PreTradeQuestion, raw: string): string {
  const value = raw.trim()
  if (question.type === "boolean") {
    const lower = value.toLowerCase()
    if (lower === "yes" || lower === "true") return "Yes"
    if (lower === "no" || lower === "false") return "No"
  }
  return value
}

export function validateAnswer(question: PreTradeQuestion, raw: string): string | null {
  const value = normalizeAnswer(question, raw)
  if (question.required && !value) {
    return "Please answer before continuing."
  }
  if (question.type === "select" && question.options && value && !question.options.includes(value)) {
    return "Choose one of the listed emotions."
  }
  if (question.key === "planned_risk") {
    const parsed = parsePercent(value)
    if (parsed === null) {
      return "Enter a valid risk percentage."
    }
  }
  return null
}

export type CoachWorkflowPhase = "upload" | "questions" | "complete"

export function getCoachWorkflowPhase(input: {
  status: string
  chartUrl?: string | null
  plannedContext: PreTradePlannedContext
  responses: Record<string, string>
  session?: Pick<TradeCoachSessionRecord, "mtf_analysis" | "planned_context"> | null
}): CoachWorkflowPhase {
  if (input.status === "completed" || input.status === "linked") return "complete"
  if (!isMtfAnalysisComplete(input.session ?? { planned_context: input.plannedContext, mtf_analysis: input.plannedContext.mtf_analysis ?? null })) {
    return "upload"
  }
  if (getNextQuestionKey(input.plannedContext, input.responses, 1, input.chartUrl)) {
    return "questions"
  }
  return "complete"
}
