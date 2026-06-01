import type { SupabaseClient } from "@supabase/supabase-js"
import { filterRowsForAccount, resolveLegacyTradeAccountId } from "@/lib/accounts/account-query"
import { isJournalTrade } from "@/lib/analytics/trade-scope"
import { getTodayCouncilEmotionCheck } from "@/lib/council/opening-service"
import type { CouncilAgentContext } from "@/lib/council/types"
import { getTradingRulesSnapshot } from "@/lib/trading-rules/trading-rules-service"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import { listWeeklySummaries } from "@/lib/weekly-chapters/server-service"
import { toWeekStartISO } from "@/lib/weekly-chapters/week-utils"

export type MarcusScenario =
  | "after_briefing"
  | "before_trade"
  | "after_loss"
  | "after_win"
  | "cooldown_active"
  | "low_emotion"

export type MarcusPsychologyContext = {
  traderFirstName: string
  lastCoachSessions: string
  emotionHistory: string
  winLossPatterns: string
  disciplineTrend: string
  cooldownLine: string
  emotionScoreToday: number | null
  cooldownActive: boolean
  lastTradeResult: string | null
  promptBlock: string
}

type CoachSessionRow = {
  id: string
  status: string
  trade_id: string | null
  planned_context: PreTradePlannedContext | null
  created_at: string
  updated_at: string
  account_id: string | null
}

type TradeRow = {
  result: string | null
  emotion: string | null
  pair: string | null
  import_source: string | null
  account_id: string | null
}

type EmotionCheckRow = {
  emotion_score: number | null
  emotion_stable: boolean | null
  created_at: string
  pair: string | null
}

type CouncilCheckinRow = {
  emotion_score: number
  session_date: string
  created_at: string
}

type JournalTradeRow = {
  result: string
  emotion: string | null
  pair: string | null
  account_id: string | null
}

async function loadOptionalTableRows<T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  try {
    const { data, error } = await query
    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}

function formatCoachSessionLine(row: CoachSessionRow, index: number): string {
  const ctx = row.planned_context
  const pair = ctx?.pair ?? "—"
  const emotion = ctx?.emotion ?? "—"
  const verdict =
    ctx?.coach_analysis?.shouldTakeTrade ??
    ctx?.coach_analysis?.vyronisCoach?.verdict ??
    row.status
  const summary =
    ctx?.coach_analysis?.summary?.slice(0, 100) ??
    ctx?.coach_analysis?.vyronisCoach?.summary?.slice(0, 100) ??
    "Coach session"
  return `${index + 1}. ${pair} — emotion ${emotion} — ${verdict} — ${summary}`
}

export async function loadMarcusPsychologyContext(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  traderFirstName: string,
): Promise<MarcusPsychologyContext> {
  const { data: accountRows } = await supabase.from("accounts").select("id, created_at").eq("user_id", userId)
  const legacyAccountId = resolveLegacyTradeAccountId(accountRows ?? [])

  const [coachSessions, emotionChecks, councilCheckins, trades, weeklySummaries, rulesSnapshot, emotionToday] =
    await Promise.all([
      supabase
        .from("trade_coach_sessions")
        .select("id, status, trade_id, planned_context, created_at, updated_at, account_id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(12)
        .then(({ data }) => (data ?? []) as CoachSessionRow[]),
      loadOptionalTableRows<EmotionCheckRow>(
        supabase
          .from("strategy_brain_emotion_checks")
          .select("emotion_score, emotion_stable, created_at, pair")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(8),
      ),
      loadOptionalTableRows<CouncilCheckinRow>(
        supabase
          .from("council_daily_checkins")
          .select("emotion_score, session_date, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(7),
      ),
      supabase
        .from("trades")
        .select("result, emotion, pair, created_at, trade_date, import_source, account_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(40)
        .then(({ data }) => (data ?? []) as TradeRow[]),
      listWeeklySummaries(supabase, userId, accountId, legacyAccountId, 6).catch(() => []),
      getTradingRulesSnapshot(supabase, userId, accountId).catch(() => null),
      getTodayCouncilEmotionCheck(supabase, userId, accountId),
    ])

  const accountCoachSessions = coachSessions.filter((row) => {
    if (!row.account_id) return true
    return row.account_id === accountId || (legacyAccountId && row.account_id === legacyAccountId)
  })

  const journalTrades = filterRowsForAccount<JournalTradeRow>(
    trades
      .filter((row) => isJournalTrade({ import_source: row.import_source }))
      .map((row) => ({
        result: String(row.result ?? ""),
        emotion: row.emotion != null ? String(row.emotion) : null,
        pair: row.pair != null ? String(row.pair) : null,
        account_id: row.account_id != null ? String(row.account_id) : null,
      })),
    accountId,
    legacyAccountId,
  )

  const wins = journalTrades.filter((row) => row.result === "WIN").length
  const losses = journalTrades.filter((row) => row.result === "LOSS").length
  const lastTradeResult = journalTrades[0]?.result ?? null

  const lastCoachSessions =
    accountCoachSessions.length > 0
      ? ["[LAST 3 COACH SESSIONS]", ...accountCoachSessions.slice(0, 3).map(formatCoachSessionLine)].join("\n")
      : "[LAST 3 COACH SESSIONS]\nNo Coach sessions yet."

  const emotionLines = [
    ...councilCheckins.map(
      (row) => `Council check-in ${row.session_date}: ${row.emotion_score}/10`,
    ),
    ...emotionChecks.map(
      (row) =>
        `Pre-trade ${String(row.created_at).slice(0, 10)}: ${row.emotion_score ?? "—"}/10${row.pair ? ` (${row.pair})` : ""}`,
    ),
  ].slice(0, 6)

  const emotionHistory =
    emotionLines.length > 0
      ? ["[EMOTION HISTORY]", ...emotionLines].join("\n")
      : "[EMOTION HISTORY]\nNo emotion scores logged yet."

  const winLossPatterns = [
    "[WIN/LOSS PATTERNS]",
    `Recent journal: ${wins}W / ${losses}L (${journalTrades.length} trades).`,
    lastTradeResult ? `Last trade: ${lastTradeResult}.` : "No trades logged yet.",
    journalTrades[0]?.emotion ? `Last emotion tag: ${journalTrades[0].emotion}.` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const disciplineLines = weeklySummaries
    .slice(0, 4)
    .map(
      (row) =>
        `${row.week_start}: ${row.discipline_score != null ? `${Math.round(row.discipline_score)}/100` : "—"}${row.discipline_grade ? ` (${row.discipline_grade})` : ""}`,
    )

  const disciplineTrend =
    disciplineLines.length > 0
      ? ["[DISCIPLINE OVER TIME]", ...disciplineLines].join("\n")
      : "[DISCIPLINE OVER TIME]\nNo chapter discipline saved yet."

  const cooldownActive = Boolean(rulesSnapshot?.cooldownRequired)
  const cooldownLine = cooldownActive
    ? "[COOLDOWN]\nCooldown active — observation / Coach unlock only. No live size."
    : "[COOLDOWN]\nNo cooldown active."

  const promptBlock = [
    lastCoachSessions,
    emotionHistory,
    winLossPatterns,
    disciplineTrend,
    cooldownLine,
    emotionToday != null ? `[TODAY EMOTION]\n${emotionToday}/10` : null,
  ]
    .filter(Boolean)
    .join("\n\n")

  return {
    traderFirstName,
    lastCoachSessions,
    emotionHistory,
    winLossPatterns,
    disciplineTrend,
    cooldownLine,
    emotionScoreToday: emotionToday,
    cooldownActive,
    lastTradeResult,
    promptBlock,
  }
}

export function detectMarcusScenario(input: {
  message: string
  psychology: MarcusPsychologyContext
  mode?: "briefing" | "conversation"
}): MarcusScenario | null {
  if (input.mode === "briefing") return "after_briefing"

  const trimmed = input.message.trim()
  if (!trimmed) return null

  if (
    input.psychology.cooldownActive &&
    (/\b(trade|enter|execute|size|setup|fomo|revenge|take|pull trigger)\b/i.test(trimmed) ||
      /\bmarcus\b/i.test(trimmed))
  ) {
    return "cooldown_active"
  }

  if (
    input.psychology.emotionScoreToday != null &&
    input.psychology.emotionScoreToday < 7 &&
    (/\b(trade|enter|execute|size|pull trigger|fomo|ready|take|feel|emotion|mindset)\b/i.test(trimmed) ||
      /\bmarcus\b/i.test(trimmed))
  ) {
    return "low_emotion"
  }

  if (
    /\b(before i (?:take|enter|execute)|about to (?:take|enter|execute)|pulling trigger|entering (?:now|the trade)|taking (?:this|the) trade|going (?:long|short)|execute now)\b/i.test(
      trimmed,
    )
  ) {
    return "before_trade"
  }

  if (
    /\b(lost|loss|stopped out|took an l|red day|blew it)\b/i.test(trimmed) ||
    (input.psychology.lastTradeResult === "LOSS" &&
      /\b(just|today|logged|closed|finished)\b/i.test(trimmed))
  ) {
    return "after_loss"
  }

  if (
    /\b(won|win|green|tp hit|banked|nice trade)\b/i.test(trimmed) ||
    (input.psychology.lastTradeResult === "WIN" &&
      /\b(just|today|logged|closed|finished)\b/i.test(trimmed))
  ) {
    return "after_win"
  }

  if (/\b(marcus|mindset|psychology|fomo|revenge|tilt|mental|emotion)\b/i.test(trimmed)) {
    if (input.psychology.cooldownActive) return "cooldown_active"
    if (input.psychology.emotionScoreToday != null && input.psychology.emotionScoreToday < 7) {
      return "low_emotion"
    }
    return "before_trade"
  }

  return null
}

export function buildMarcusLivePrompt(
  psychology: MarcusPsychologyContext,
  scenario: MarcusScenario,
): string {
  return [
    "MARCUS PSYCHOLOGY DATA — mindset only. Never cite prices, pairs, or technical levels.",
    psychology.promptBlock,
    `[SCENARIO: ${scenario.replace("_", " ").toUpperCase()}]`,
    "Use the trader's first name. Sound deep, warm, and wise — never clinical.",
  ].join("\n\n")
}

export function buildMarcusFallbackReply(input: {
  scenario: MarcusScenario
  traderFirstName: string
  psychology: MarcusPsychologyContext
}): string {
  const name = input.traderFirstName.trim() || "Trader"
  const { psychology } = input

  switch (input.scenario) {
    case "after_briefing": {
      const discipline =
        psychology.disciplineTrend.includes("/100")
          ? psychology.disciplineTrend.split("\n")[1]?.trim()
          : null
      const strength =
        psychology.winLossPatterns.includes("WIN")
          ? "You showed up and ran Coach — that discipline matters."
          : "You kept the routine this week — that is the foundation."
      const improve = discipline
        ? "Protect your emotional score before the first click tomorrow."
        : "Name one feeling before you execute tomorrow — not the setup, the feeling."
      return `${name}, I've reviewed your week. ${strength} ${improve} One question before tomorrow: what would patience look like on your very first decision?`
    }
    case "before_trade":
      return `Before you execute — is this your setup or FOMO? Take 10 seconds. Breathe. If it's still valid, go.`
    case "after_loss":
      return `One loss doesn't define you, ${name}. You followed your rules. That's all that matters today. Rest. Come back tomorrow.`
    case "after_win":
      return `Good execution, ${name}. Notice what you did right. That's your standard now. Don't chase another one today.`
    case "cooldown_active":
      return `${name}, cooldown is active — this is observation mode, not punishment. Protect the account. Process first. Trade second.`
    case "low_emotion":
      return `${name}, your emotional score is below where we want it. Slow down. Paper or observe today unless Rex and Coach both clear you.`
  }
}

export function buildMarcusUserPrompt(input: {
  scenario: MarcusScenario
  question?: string
  traderFirstName: string
}): string {
  const lines = [
    `Scenario: ${input.scenario.replace(/_/g, " ")}.`,
    `Trader: ${input.traderFirstName}.`,
  ]
  if (input.question?.trim()) {
    lines.push(`Trader message: ${input.question.trim()}`)
  }
  lines.push(
    "Respond as Marcus — personal trading psychologist. Mindset and growth only. No technical analysis.",
  )
  return lines.join("\n")
}

export async function shouldMarcusChimeIn(input: {
  supabase: SupabaseClient
  userId: string
  accountId: string
  traderFirstName: string
  message: string
  primaryAgent: string
  excludeAgents: string[]
}): Promise<{ scenario: MarcusScenario; psychology: MarcusPsychologyContext } | null> {
  if (input.primaryAgent === "marcus" || input.excludeAgents.includes("marcus")) {
    return null
  }

  const psychology = await loadMarcusPsychologyContext(
    input.supabase,
    input.userId,
    input.accountId,
    input.traderFirstName,
  )

  const scenario = detectMarcusScenario({
    message: input.message,
    psychology,
    mode: "conversation",
  })

  if (!scenario) return null
  return { scenario, psychology }
}
