import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveLegacyTradeAccountId } from "@/lib/accounts/account-query"
import { normalizeForexPairSymbol } from "@/lib/council/forex-pair-format"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import { isTradeInWeekStart, toWeekStartISO } from "@/lib/weekly-chapters/week-utils"

type CoachSessionRow = {
  id: string
  status: string
  trade_id: string | null
  quality_grade: string | null
  recommendation: string | null
  quality_score: number | null
  confidence_score: number | null
  warnings: string[] | null
  strengths: string[] | null
  planned_context: PreTradePlannedContext | null
  created_at: string
  updated_at: string
  account_id: string | null
}

type CoachFeedbackRow = {
  trade_id: string
  discipline_score: number | null
  coaching_summary: string | null
  feedback_points: string[] | null
}

export type CouncilCoachLiveData = {
  shared: string
  nova: string
  zara: string
  rex: string
  luna: string
  cipher: string
  jarvis: string
}

function formatVerdict(context: PreTradePlannedContext | null | undefined): string {
  const analysis = context?.coach_analysis
  if (analysis?.vyronisCoach?.verdict) return analysis.vyronisCoach.verdict
  if (analysis?.shouldTakeTrade === "yes") return "TAKE"
  if (analysis?.shouldTakeTrade === "no") return "SKIP"
  if (analysis?.shouldTakeTrade === "caution") return "CAUTION"
  if (analysis?.tradeQuality?.recommendation) return analysis.tradeQuality.recommendation
  return "PENDING"
}

function formatGrade(row: CoachSessionRow): string {
  return (
    row.quality_grade?.trim() ||
    row.planned_context?.coach_analysis?.tradeQuality?.grade?.trim() ||
    row.planned_context?.tradingview_setup_grade?.trim() ||
    "—"
  )
}

function pairKey(pair: string | null | undefined): string {
  return String(pair ?? "").replace(/\s/g, "").toUpperCase()
}

function formatActiveSession(row: CoachSessionRow): string {
  const ctx = row.planned_context
  const pair = normalizeForexPairSymbol(String(ctx?.pair ?? "—"))
  const direction = String(ctx?.direction ?? "—").toUpperCase()
  const emotion = ctx?.emotion ?? "—"
  const grade = formatGrade(row)
  const verdict = formatVerdict(ctx)
  const score =
    row.quality_score ??
    ctx?.coach_analysis?.tradeQuality?.score ??
    ctx?.coach_analysis?.vyronisCoach?.setup_score ??
    null
  const summary =
    ctx?.coach_analysis?.summary?.trim() ||
    ctx?.coach_analysis?.vyronisCoach?.summary?.trim() ||
    ctx?.chart_analysis?.summary?.trim() ||
    "Pre-trade check in progress."

  const warnings = [
    ...(row.warnings ?? []),
    ...(ctx?.coach_analysis?.redFlags?.map((flag) => flag.message) ?? []),
    ...(ctx?.coach_analysis?.vyronisCoach?.warnings ?? []),
  ].slice(0, 2)

  return [
    `${pair} ${direction} — ${row.status.replace("_", " ")}`,
    `Grade ${grade}${score != null ? ` · Score ${Math.round(score)}` : ""} · Verdict ${verdict}`,
    `Emotion: ${emotion}`,
    `Summary: ${summary.slice(0, 120)}`,
    warnings.length > 0 ? `Flags: ${warnings.join("; ")}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

function formatCompletedSession(row: CoachSessionRow, index: number): string {
  const ctx = row.planned_context
  const pair = normalizeForexPairSymbol(String(ctx?.pair ?? "—"))
  const direction = String(ctx?.direction ?? "—").toUpperCase()
  const grade = formatGrade(row)
  const verdict = formatVerdict(ctx)
  const linked = row.trade_id ? " (logged)" : ""
  return `${index + 1}. ${pair} ${direction}${linked} — ${grade} — ${verdict}`
}

async function loadCoachSessions(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<CoachSessionRow[]> {
  const { data: accountRows } = await supabase.from("accounts").select("id, created_at").eq("user_id", userId)
  const legacyAccountId = resolveLegacyTradeAccountId(accountRows ?? [])

  let query = supabase
    .from("trade_coach_sessions")
    .select(
      "id, status, trade_id, quality_grade, recommendation, quality_score, confidence_score, warnings, strengths, planned_context, created_at, updated_at, account_id",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(12)

  if (accountId) {
    query = query.or(
      legacyAccountId && accountId === legacyAccountId
        ? `account_id.eq.${accountId},account_id.is.null`
        : `account_id.eq.${accountId}`,
    )
  }

  const { data, error } = await query
  if (error) {
    if (/trade_coach_sessions|relation .* does not exist|schema cache/i.test(error.message)) {
      return []
    }
    throw new Error(error.message)
  }

  return (data ?? []) as CoachSessionRow[]
}

async function loadCoachFeedbackForTrades(
  supabase: SupabaseClient,
  userId: string,
  tradeIds: string[],
): Promise<Map<string, CoachFeedbackRow>> {
  if (tradeIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from("trade_coach_feedback")
    .select("trade_id, discipline_score, coaching_summary, feedback_points")
    .eq("user_id", userId)
    .in("trade_id", tradeIds)

  if (error) {
    if (/trade_coach_feedback|relation .* does not exist|schema cache/i.test(error.message)) {
      return new Map()
    }
    throw new Error(error.message)
  }

  const map = new Map<string, CoachFeedbackRow>()
  for (const row of data ?? []) {
    if (row.trade_id) map.set(String(row.trade_id), row as CoachFeedbackRow)
  }
  return map
}

export async function loadCouncilCoachLiveData(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  recentTrades: Array<{
    id: string
    pair: string | null
    direction: string | null
    result: string | null
  }>,
  watchlistPairs: string[],
): Promise<CouncilCoachLiveData> {
  const weekStart = toWeekStartISO(new Date())
  const sessions = await loadCoachSessions(supabase, userId, accountId)
  const feedbackByTrade = await loadCoachFeedbackForTrades(
    supabase,
    userId,
    recentTrades.map((row) => row.id),
  )

  const sessionsThisWeek = sessions.filter((row) => {
    const raw = String(row.updated_at ?? row.created_at ?? "")
    return isTradeInWeekStart({ trade_date: raw.slice(0, 10), created_at: raw }, weekStart)
  }).length

  const activeSession =
    sessions.find((row) => row.status === "in_progress" && !row.trade_id) ?? null
  const completedSessions = sessions.filter(
    (row) => row.status === "completed" || row.trade_id != null,
  )

  const disciplineScores = [...feedbackByTrade.values()]
    .map((row) => row.discipline_score)
    .filter((score): score is number => score != null)
  const avgDiscipline =
    disciplineScores.length > 0
      ? Math.round(disciplineScores.reduce((sum, score) => sum + score, 0) / disciplineScores.length)
      : null

  const feedbackLines = recentTrades.map((trade, index) => {
    const feedback = feedbackByTrade.get(trade.id)
    const pair = normalizeForexPairSymbol(String(trade.pair ?? "—"))
    const direction = String(trade.direction ?? "—").toUpperCase()
    const result = String(trade.result ?? "—").toUpperCase()
    if (!feedback) {
      return `${index + 1}. ${pair} ${direction} ${result} — no Coach review yet`
    }
    const summary = feedback.coaching_summary?.trim() || feedback.feedback_points?.[0] || "Review saved"
    return `${index + 1}. ${pair} ${direction} ${result} — discipline ${feedback.discipline_score ?? "—"}/100 — ${summary.slice(0, 80)}`
  })

  const coachFeedbackSection =
    feedbackLines.length > 0
      ? ["[COACH FEEDBACK — last trades]", ...feedbackLines].join("\n")
      : "[COACH FEEDBACK — last trades]\nNo Coach reviews on recent trades yet."

  const activeSection = activeSession
    ? ["[COACH — ACTIVE SESSION]", formatActiveSession(activeSession)].join("\n")
    : "[COACH — ACTIVE SESSION]\nNo open Coach session — run Coach before committing size."

  const recentCompletedLines = completedSessions.slice(0, 3).map(formatCompletedSession)
  const recentSection =
    recentCompletedLines.length > 0
      ? ["[COACH — RECENT ANALYSES]", ...recentCompletedLines].join("\n")
      : "[COACH — RECENT ANALYSES]\nNo completed Coach runs yet this account."

  const shared = [
    "[COACH STATUS]",
    `Sessions this week: ${sessionsThisWeek}`,
    avgDiscipline != null ? `Avg discipline (recent reviewed trades): ${avgDiscipline}/100` : null,
    activeSession
      ? `Active: ${normalizeForexPairSymbol(String(activeSession.planned_context?.pair ?? "—"))} ${String(activeSession.planned_context?.direction ?? "").toUpperCase()} — ${formatVerdict(activeSession.planned_context)}`
      : "Active: none",
  ]
    .filter(Boolean)
    .join("\n")

  const watchlistKeys = new Set(watchlistPairs.map(pairKey))
  const watchlistCoachSessions = sessions.filter((row) =>
    watchlistKeys.has(pairKey(row.planned_context?.pair)),
  )
  const watchlistCoachLines = watchlistCoachSessions.slice(0, 4).map((row) => {
    const pair = normalizeForexPairSymbol(String(row.planned_context?.pair ?? "—"))
    return `${pair} — ${formatGrade(row)} — ${formatVerdict(row.planned_context)} — ${row.status}`
  })
  const watchlistCoachSection =
    watchlistCoachLines.length > 0
      ? ["[COACH — WATCHLIST SETUPS]", ...watchlistCoachLines].join("\n")
      : "[COACH — WATCHLIST SETUPS]\nNo Coach runs on current watchlist pairs yet."

  const rexFlags = activeSession
    ? [
        ...(activeSession.warnings ?? []),
        ...(activeSession.planned_context?.coach_analysis?.redFlags?.map((f) => f.message) ?? []),
      ].slice(0, 3)
    : completedSessions[0]
      ? [
          ...(completedSessions[0].warnings ?? []),
          ...(completedSessions[0].planned_context?.coach_analysis?.redFlags?.map((f) => f.message) ??
            []),
        ].slice(0, 3)
      : []

  const rexRiskLevel =
    activeSession?.planned_context?.coach_analysis?.vyronisCoach?.risk_level ??
    completedSessions[0]?.planned_context?.coach_analysis?.vyronisCoach?.risk_level ??
    null

  const rexSection = [
    "[COACH — RISK READ]",
    rexRiskLevel ? `Risk level: ${rexRiskLevel}` : "Risk level: not scored yet",
    activeSession
      ? `Verdict: ${formatVerdict(activeSession.planned_context)} · Grade ${formatGrade(activeSession)}`
      : completedSessions[0]
        ? `Last verdict: ${formatVerdict(completedSessions[0].planned_context)} · Grade ${formatGrade(completedSessions[0])}`
        : "Last verdict: none",
    rexFlags.length > 0 ? `Coach flags: ${rexFlags.join("; ")}` : "Coach flags: none flagged",
    "Rule: no live size until Coach clears the setup unless Cole confirms room.",
  ].join("\n")

  const novaSection = [
    shared,
    avgDiscipline != null ? `Coach discipline trend: ${avgDiscipline}/100 on reviewed trades.` : null,
    activeSession?.planned_context?.emotion
      ? `Latest pre-trade emotion in Coach: ${activeSession.planned_context.emotion}.`
      : null,
  ]
    .filter(Boolean)
    .join("\n")

  const jarvis = [
    shared,
    activeSection,
    recentSection,
    coachFeedbackSection,
    watchlistCoachSection,
    rexSection,
  ].join("\n\n")

  return {
    shared,
    nova: novaSection,
    zara: coachFeedbackSection,
    rex: rexSection,
    luna: [watchlistCoachSection, activeSection].join("\n\n"),
    cipher: [watchlistCoachSection, activeSection].join("\n\n"),
    jarvis,
  }
}
