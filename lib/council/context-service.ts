import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateAccountStatus } from "@/lib/account-status"
import { fetchUserStartingBalance, fetchUserTradesForAnalytics } from "@/lib/analytics/fetch-trades"
import type { AnalyticsTradeRow } from "@/lib/analytics/types"
import { isJournalTrade } from "@/lib/analytics/trade-scope"
import { belongsToAccount, filterRowsForAccount, resolveLegacyTradeAccountId } from "@/lib/accounts/account-query"
import { getTradingAccount } from "@/lib/accounts/trading-account-service"
import {
  COUNCIL_JOURNAL_LAST_TRADE_CHARTS_LIMIT,
  COUNCIL_JOURNAL_LAST_TRADES_LIMIT,
  type CouncilDataScope,
} from "@/lib/council/data-scope"
import type { CouncilAgentContext } from "@/lib/council/types"
import { evaluateMarketBias } from "@/lib/strategy-brain/market-bias-engine"
import { getMarketBias, getWeeklyPlanWithPairs } from "@/lib/strategy-brain/server-service"
import type {
  AoiStatus,
  ConfirmationChecklist,
  PairPlanRecord,
  SetupGrade,
  TradeRecommendation,
  WeeklyPlanWithPairs,
} from "@/lib/strategy-brain/types"
import { getTradingRulesSnapshot } from "@/lib/trading-rules/trading-rules-service"
import { normalizeForexPairSymbol } from "@/lib/council/forex-pair-format"
import { buildJarvisContextSnapshot } from "@/lib/council/jarvis-service"
import { buildRexCalendarLine } from "@/lib/economic-calendar/briefing-lines"
import { getTodayCalendarSnapshot } from "@/lib/economic-calendar/service"
import {
  buildRiskSnapshot,
  getLocalDateKey,
  getTradeDateKey,
  normalizePreferredSession,
  normalizeUserSettings,
  resolveTradingDayTimeZone,
  type SettingsTrade,
} from "@/lib/user-settings"
import { formatPnL, getSignedPnL } from "@/lib/trade-utils"
import { buildChapterEmotionSummary } from "@/lib/weekly-chapters/chapter-emotion-scores"
import { resolveCurrentWeekDiscipline } from "@/lib/weekly-chapters/discipline-resolver"
import { detectChapterReviewPatterns } from "@/lib/weekly-chapters/chapter-patterns"
import { warRoomWeekStartCandidates } from "@/lib/weekly-chapters/chapter-war-room-recap"
import { buildChapterTradeReviewNotes } from "@/lib/weekly-chapters/trade-review-notes"
import {
  isDirectImageUrl,
  pickBestWarRoomScreenshot,
  resolveSignalChartImageUrl,
} from "@/lib/tradingview/signal-chart-resolution"
import {
  getWeeklyChapterDashboard,
  listWeeklySummaries,
} from "@/lib/weekly-chapters/server-service"
import type { ChapterReviewTrade, WeeklySummaryRecord } from "@/lib/weekly-chapters/types"
import {
  disciplineGradeFromScore,
  formatChapterTitle,
  isTradeInWeekStart,
  toWeekStartISO,
} from "@/lib/weekly-chapters/week-utils"

type TradeRow = {
  id: string
  pair: string | null
  direction: string | null
  result: string | null
  pnl: number | null
  emotion: string | null
  emotion_after: string | null
  session: string | null
  rule_followed: boolean | null
  mistake_tags: string | null
  trade_date: string | null
  created_at: string | null
  import_source: string | null
  entry_price: number | null
  stop_loss: number | null
  take_profit: number | null
  trade_notes: string | null
  setup_classification: string | null
  confirmation_signal: string | null
  confirmation_timeframe: string | null
  risk_percent: number | null
  screenshot_url: string | null
  chart_url: string | null
  account_id: string | null
}

type SetupEvaluationRow = {
  id: string
  pair: string
  pair_plan_id: string | null
  grade: SetupGrade | null
  recommendation: TradeRecommendation | null
  total_score: number | null
  confirmation: ConfirmationChecklist | null
  created_at: string
}

type EmotionCheckRow = {
  pair: string | null
  emotion_score: number | null
  emotion_stable: boolean | null
  created_at: string
}

async function loadTraderProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ firstName: string; timeZone: string }> {
  const { data } = await supabase
    .from("user_profiles")
    .select("first_name, timezone")
    .eq("user_id", userId)
    .maybeSingle()
  return {
    firstName: data?.first_name?.trim() || "Trader",
    timeZone: resolveTradingDayTimeZone(data?.timezone),
  }
}

function mapTradeRowsToSettingsTrades(
  tradeRows: TradeRow[],
  startingBalance: number,
): SettingsTrade[] {
  return tradeRows.map((row) => {
    const result = String(row.result ?? "")
    let pnl = Number(row.pnl ?? 0)
    if (
      result === "LOSS" &&
      getSignedPnL(pnl, result) === 0 &&
      (row.risk_percent ?? 0) > 0 &&
      startingBalance > 0
    ) {
      pnl = (startingBalance * (row.risk_percent ?? 0)) / 100
    }
    return {
      risk_percent: row.risk_percent,
      rule_followed: row.rule_followed,
      emotion: row.emotion ?? "",
      stop_loss: row.stop_loss,
      trade_date: row.trade_date,
      created_at: row.created_at ?? new Date().toISOString(),
      result,
      pnl,
    }
  })
}

function mapAnalyticsTradeToTradeRow(
  trade: AnalyticsTradeRow & {
    screenshot_url?: string | null
    chart_url?: string | null
    trade_notes?: string | null
    setup_classification?: string | null
  },
): TradeRow {
  return {
    id: trade.id,
    pair: trade.pair ?? null,
    direction: trade.direction ?? null,
    result: trade.result ?? null,
    pnl: trade.pnl ?? null,
    emotion: trade.emotion ?? null,
    emotion_after: trade.emotion_after ?? null,
    session: trade.session ?? null,
    rule_followed: trade.rule_followed,
    mistake_tags: trade.mistake_tags ?? null,
    trade_date: trade.trade_date,
    created_at: trade.created_at,
    import_source: trade.import_source ?? null,
    entry_price: trade.entry_price ?? null,
    stop_loss: trade.stop_loss ?? null,
    take_profit: trade.take_profit ?? null,
    trade_notes: trade.trade_notes ?? null,
    setup_classification: trade.setup_classification ?? null,
    confirmation_signal: trade.confirmation_signal ?? null,
    confirmation_timeframe: trade.confirmation_timeframe ?? null,
    risk_percent: trade.risk_percent,
    screenshot_url: trade.screenshot_url ?? null,
    chart_url: trade.chart_url ?? null,
    account_id: trade.account_id ?? null,
  }
}

async function loadCouncilJournalTrades(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  legacyAccountId: string | null,
): Promise<{ allJournalRows: TradeRow[]; tradeRows: TradeRow[]; loadError: string | null }> {
  const [allResult, scopedResult] = await Promise.all([
    fetchUserTradesForAnalytics(supabase, userId, "manual"),
    fetchUserTradesForAnalytics(supabase, userId, "manual", {
      accountId,
      legacyAccountId,
    }),
  ])

  let allJournalRows = allResult.trades.map(mapAnalyticsTradeToTradeRow)
  let tradeRows = scopedResult.trades.map(mapAnalyticsTradeToTradeRow)
  let loadError = allResult.error ?? scopedResult.error

  if (allJournalRows.length === 0) {
    const raw = await supabase
      .from("trades")
      .select(
        "id, pair, direction, result, pnl, emotion, emotion_after, session, rule_followed, mistake_tags, trade_date, created_at, import_source, entry_price, stop_loss, take_profit, trade_notes, setup_classification, confirmation_signal, confirmation_timeframe, risk_percent, screenshot_url, chart_url, account_id",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(120)

    if (!raw.error && raw.data?.length) {
      allJournalRows = (raw.data as TradeRow[]).filter((row) =>
        isJournalTrade({ import_source: row.import_source }),
      )
      tradeRows = filterRowsForAccount(allJournalRows, accountId, legacyAccountId)
      loadError = null
    } else if (raw.error && !loadError) {
      loadError = raw.error.message
    }
  }

  return { allJournalRows, tradeRows, loadError }
}

function buildCouncilDataNote(
  tradeRows: TradeRow[],
  allJournalRows: TradeRow[],
  accountId: string,
  legacyAccountId: string | null,
  loadError: string | null,
): string | null {
  if (loadError) {
    return `Journal could not load (${loadError}). Refresh the page — stats use the same Vyronis journal as HQ Log.`
  }

  if (tradeRows.length === 0 && allJournalRows.length === 0) {
    return "No trades in your Vyronis journal yet — tap Log on HQ to record a trade. Council does not read your live broker balance."
  }

  const otherAccountCount = allJournalRows.filter(
    (row) => !belongsToAccount(row, accountId, legacyAccountId),
  ).length

  if (tradeRows.length === 0 && otherAccountCount > 0) {
    return `${otherAccountCount} journal trade${otherAccountCount === 1 ? "" : "s"} are on another account — use the account switcher at the top.`
  }

  const missingPnlLosses = tradeRows.filter(
    (row) =>
      String(row.result ?? "") === "LOSS" &&
      getSignedPnL(Number(row.pnl ?? 0), String(row.result ?? "")) === 0,
  ).length
  if (missingPnlLosses > 0) {
    return `${missingPnlLosses} loss${missingPnlLosses === 1 ? "" : "es"} missing dollar P&L — balance uses risk % estimate until you edit the trade.`
  }
  return null
}

function buildTodayRexJournalLine(
  tradeRows: TradeRow[],
  timeZone: string,
  currency: string,
  startingBalance: number,
): string {
  const todayKey = getLocalDateKey(new Date(), timeZone)
  const todayRows = tradeRows.filter((row) =>
    getTradeDateKey({
      trade_date: row.trade_date,
      created_at: row.created_at ?? new Date().toISOString(),
    }) === todayKey,
  )

  if (todayRows.length === 0) {
    const latest = tradeRows[0]
    if (latest) {
      const result = String(latest.result ?? "")
      let pnl = Number(latest.pnl ?? 0)
      if (
        result === "LOSS" &&
        getSignedPnL(pnl, result) === 0 &&
        (latest.risk_percent ?? 0) > 0
      ) {
        pnl = (startingBalance * (latest.risk_percent ?? 0)) / 100
      }
      const latestDate =
        latest.trade_date?.slice(0, 10) ??
        latest.created_at?.slice(0, 10) ??
        "unknown date"
      const pair = normalizeForexPairSymbol(latest.pair ?? "—")
      return `Journal today (${todayKey}): no trades today. Latest on this account: ${latestDate} — ${pair} ${result} ${formatPnL(pnl, result)}.`
    }
    return `Journal today (${todayKey}): no trades logged for this account in Vyronis.`
  }

  const entries = todayRows.map((row) => {
    const result = String(row.result ?? "")
    let pnl = Number(row.pnl ?? 0)
    if (
      result === "LOSS" &&
      getSignedPnL(pnl, result) === 0 &&
      (row.risk_percent ?? 0) > 0
    ) {
      pnl = ((startingBalance * (row.risk_percent ?? 0)) / 100)
    }
    const signed = getSignedPnL(pnl, result)
    const pair = normalizeForexPairSymbol(row.pair ?? "—")
    if (result === "LOSS" && Number(row.pnl ?? 0) === 0 && signed < 0) {
      return `${pair} LOSS ~${formatPnL(Math.abs(signed), "WIN")} (estimated from ${row.risk_percent}% risk)`
    }
    return `${pair} ${result} ${formatPnL(Number(row.pnl ?? 0), result)}`
  })

  const netPnL = todayRows.reduce((sum, row) => {
    const result = String(row.result ?? "")
    let pnl = Number(row.pnl ?? 0)
    if (
      result === "LOSS" &&
      getSignedPnL(pnl, result) === 0 &&
      (row.risk_percent ?? 0) > 0
    ) {
      pnl = (startingBalance * (row.risk_percent ?? 0)) / 100
    }
    return sum + getSignedPnL(pnl, result)
  }, 0)

  return `Journal today (${todayKey}): ${todayRows.length} trade(s), net ${formatMoney(netPnL, currency)} — ${entries.join("; ")}.`
}

async function loadDisciplineScoresByTradeId(
  supabase: SupabaseClient,
  userId: string,
  tradeIds: string[],
): Promise<Map<string, number>> {
  if (tradeIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from("trade_coach_feedback")
    .select("trade_id, discipline_score")
    .eq("user_id", userId)
    .in("trade_id", tradeIds)

  if (error) {
    if (/trade_coach_feedback|relation .* does not exist|schema cache/i.test(error.message)) {
      return new Map()
    }
    throw new Error(error.message)
  }

  const map = new Map<string, number>()
  for (const row of data ?? []) {
    if (row.trade_id != null && row.discipline_score != null) {
      map.set(String(row.trade_id), Number(row.discipline_score))
    }
  }
  return map
}

async function loadSetupEvaluations(
  supabase: SupabaseClient,
  userId: string,
): Promise<SetupEvaluationRow[]> {
  const { data, error } = await supabase
    .from("strategy_brain_setup_evaluations")
    .select("id, pair, pair_plan_id, grade, recommendation, total_score, confirmation, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(24)

  if (error) {
    if (/strategy_brain_setup_evaluations|relation .* does not exist|schema cache/i.test(error.message)) {
      return []
    }
    throw new Error(error.message)
  }

  return (data ?? []) as SetupEvaluationRow[]
}

async function loadRecentEmotionChecks(
  supabase: SupabaseClient,
  userId: string,
): Promise<EmotionCheckRow[]> {
  const { data, error } = await supabase
    .from("strategy_brain_emotion_checks")
    .select("pair, emotion_score, emotion_stable, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(6)

  if (error) {
    if (/strategy_brain_emotion_checks|relation .* does not exist|schema cache/i.test(error.message)) {
      return []
    }
    throw new Error(error.message)
  }

  return (data ?? []) as EmotionCheckRow[]
}

function formatMoney(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPrice(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—"
  return String(value)
}

function latestEvaluationsByPair(
  evaluations: SetupEvaluationRow[],
): Map<string, SetupEvaluationRow> {
  const map = new Map<string, SetupEvaluationRow>()
  for (const row of evaluations) {
    const key = row.pair.replace(/\s/g, "").toUpperCase()
    if (!map.has(key)) map.set(key, row)
  }
  return map
}

function latestEvaluationsByPlanId(
  evaluations: SetupEvaluationRow[],
): Map<string, SetupEvaluationRow> {
  const map = new Map<string, SetupEvaluationRow>()
  for (const row of evaluations) {
    if (!row.pair_plan_id) continue
    if (!map.has(row.pair_plan_id)) map.set(row.pair_plan_id, row)
  }
  return map
}

function formatM15ConfirmationStatus(
  aoiStatus: AoiStatus,
  confirmation?: ConfirmationChecklist | null,
  confirmationSignal?: string | null,
): string {
  if (aoiStatus === "CONFIRMING") return "M15 confirmation active"
  if (aoiStatus === "INVALIDATED") return "Setup invalidated"

  const signals = confirmation
    ? [
        confirmation.break_and_retest === true && "break & retest",
        confirmation.ltf_structure_shift === true && "structure shift",
        confirmation.momentum_confirmation === true && "momentum",
        confirmation.ema_confirmation === true && "EMA",
      ].filter(Boolean)
    : []

  if (signals.length >= 2) return `M15 confirmed (${signals.join(", ")})`
  if (signals.length === 1) return `M15 partial (${signals[0]})`
  if (confirmationSignal?.trim()) return `M15 signal: ${confirmationSignal.trim()}`
  if (aoiStatus === "INSIDE_AOI") return "At H4 zone — awaiting M15 confirmation"
  return "Waiting for price at H4 zone"
}

function formatApexFilterStatus(input: {
  directionalPermission: boolean
  setupValid: boolean
  grade: SetupGrade | null
  recommendation: TradeRecommendation | null
  conflictSummary: string | null
}): string {
  const htfPass = input.directionalPermission && input.setupValid
  const gradePass = input.grade === "A+" || input.grade === "B"
  if (htfPass && gradePass && input.recommendation === "TAKE") return "PASS"
  if (htfPass && gradePass) return "HTF aligned — grade OK"
  if (htfPass) return "HTF aligned — grade pending"
  return input.conflictSummary?.trim() || "HTF not aligned"
}

function isActiveOpportunity(status: AoiStatus): boolean {
  return status === "INSIDE_AOI" || status === "CONFIRMING"
}

function mapTradeForPatterns(row: TradeRow): ChapterReviewTrade {
  return {
    id: String(row.id),
    pair: normalizeForexPairSymbol(String(row.pair ?? "—")),
    direction: String(row.direction ?? "—"),
    result: String(row.result ?? "—"),
    pnl: getSignedPnL(Number(row.pnl ?? 0), String(row.result ?? "")),
    session: row.session != null ? String(row.session) : null,
    emotion: row.emotion != null ? String(row.emotion) : null,
    entry_price: row.entry_price != null ? Number(row.entry_price) : null,
    stop_loss: row.stop_loss != null ? Number(row.stop_loss) : null,
    take_profit: row.take_profit != null ? Number(row.take_profit) : null,
    screenshot_url: null,
    chart_url: null,
    trade_date: row.trade_date != null ? String(row.trade_date) : null,
    rule_followed:
      row.rule_followed === null || row.rule_followed === undefined
        ? null
        : Boolean(row.rule_followed),
    mistake_tags: row.mistake_tags != null ? String(row.mistake_tags) : null,
    coach_grade: null,
    coach_insight: null,
    coach_session_id: null,
    what_went_right: null,
    what_went_wrong: null,
  }
}

function buildNovaContext(input: {
  chapterLabel: string
  currentSummary: WeeklySummaryRecord | null
  dashboardDisciplineScore: number | null
  dashboardDisciplineGrade: string | null
  weekTrades: TradeRow[]
  maxTrades: number
  tradesRemaining: number
  previousChapter: WeeklySummaryRecord | null
  emotionSummary: ReturnType<typeof buildChapterEmotionSummary>
  recentEmotionChecks: EmotionCheckRow[]
  disciplineByTradeId: Map<string, number>
}): string {
  const summary = input.currentSummary
  const chapterStats = summary
    ? `Chapter ${summary.chapter_number}: ${summary.trades_taken} trades, ${summary.wins}W/${summary.losses}L, ${summary.win_rate}% win, P&L ${summary.pnl.toFixed(0)}.`
    : `${input.chapterLabel} — summary not saved yet.`

  const disciplineScore =
    summary?.discipline_score ??
    input.dashboardDisciplineScore ??
    input.emotionSummary?.disciplineAverage ??
    null
  const disciplineGrade =
    summary?.discipline_grade ??
    input.dashboardDisciplineGrade ??
    (disciplineScore != null ? `${disciplineScore}/100` : null)

  const disciplineLine =
    disciplineScore != null
      ? `Discipline score: ${Math.round(disciplineScore)}/100${disciplineGrade ? ` (${disciplineGrade})` : ""}.`
      : "Discipline score: not enough data yet."

  const coachDiscipline = [...input.disciplineByTradeId.values()]
  const coachLine =
    coachDiscipline.length > 0
      ? `Coach discipline on recent trades: avg ${Math.round(coachDiscipline.reduce((a, b) => a + b, 0) / coachDiscipline.length)}/100.`
      : null

  const emotionTimeline = input.emotionSummary?.timeline.slice(-5) ?? []
  const emotionLine =
    emotionTimeline.length > 0
      ? `Emotional history (recent): ${emotionTimeline
          .map(
            (point) =>
              `${normalizeForexPairSymbol(point.pair)} ${point.emotion ?? "—"} (${point.emotionalScore}/100${point.disciplineScore != null ? `, discipline ${point.disciplineScore}` : ""})`,
          )
          .join("; ")}. Stability avg ${input.emotionSummary?.emotionalStability ?? "—"}/100.`
      : input.weekTrades.length > 0
        ? `Emotional history: ${input.weekTrades
            .slice(0, 5)
            .map((trade) => `${normalizeForexPairSymbol(trade.pair)} ${trade.emotion ?? "—"}`)
            .join("; ")}.`
        : "Emotional history: no trades logged this chapter yet."

  const preTradeChecks =
    input.recentEmotionChecks.length > 0
      ? `Pre-trade emotion checks: ${input.recentEmotionChecks
          .map(
            (check) =>
              `${check.pair ?? "—"} score ${check.emotion_score ?? "—"}/10${check.emotion_stable ? " stable" : " unstable"}`,
          )
          .join("; ")}.`
      : null

  const previousLine = input.previousChapter
    ? `Previous chapter: discipline ${input.previousChapter.discipline_score ?? "—"}/100, lesson "${input.previousChapter.key_lesson || "Protect process."}".`
    : "First chapter — build steady habits."

  return [
    `Current chapter (${input.chapterLabel}): ${chapterStats}`,
    `Live trades this week: ${input.weekTrades.length}/${input.maxTrades}. Slots remaining: ${input.tradesRemaining}.`,
    disciplineLine,
    coachLine,
    emotionLine,
    preTradeChecks,
    previousLine,
  ]
    .filter(Boolean)
    .join(" ")
}

function averageCoachDisciplineForTrades(
  trades: TradeRow[],
  disciplineByTradeId: Map<string, number>,
): number | null {
  const scores = trades
    .map((row) => disciplineByTradeId.get(String(row.id)))
    .filter((value): value is number => value != null && Number.isFinite(value))
  if (scores.length === 0) return null
  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
}

function buildZaraContext(input: {
  tradeRows: TradeRow[]
  disciplineByTradeId: Map<string, number>
  scopeLabel?: string
}): string {
  const scopePrefix =
    input.scopeLabel === "this week only"
      ? "Trades this week only: "
      : input.scopeLabel === "last trades from Vyronis journal"
        ? "Last trades from Vyronis journal: "
        : "Last 3 trades: "
  const lastThree = input.tradeRows.slice(0, 3).map((row) => {
    const pnl = getSignedPnL(Number(row.pnl ?? 0), String(row.result ?? ""))
    const notes = buildChapterTradeReviewNotes({
      result: String(row.result ?? "—"),
      pnl,
      emotion: row.emotion != null ? String(row.emotion) : null,
      rule_followed:
        row.rule_followed === null || row.rule_followed === undefined
          ? null
          : Boolean(row.rule_followed),
      mistake_tags: row.mistake_tags != null ? String(row.mistake_tags) : null,
      coach_grade: null,
      coach_insight: null,
      coach_strengths: [],
      coach_warnings: [],
    })
    const coachDiscipline = input.disciplineByTradeId.get(String(row.id))
    const noteText = row.trade_notes?.trim() || notes.whatWentWrong || notes.whatWentRight || "no notes"
    return [
      `${normalizeForexPairSymbol(row.pair)} ${row.direction} ${row.result}`,
      `entry ${formatPrice(row.entry_price)} SL ${formatPrice(row.stop_loss)} TP ${formatPrice(row.take_profit)}`,
      `emotion ${row.emotion ?? "—"}${row.emotion_after ? ` → ${row.emotion_after}` : ""}`,
      row.setup_classification ? `grade ${row.setup_classification}` : null,
      coachDiscipline != null ? `discipline ${coachDiscipline}/100` : null,
      `notes: ${noteText}`,
    ]
      .filter(Boolean)
      .join(", ")
  })

  const patterns = detectChapterReviewPatterns(input.tradeRows.slice(0, 12).map(mapTradeForPatterns))
    .map((pattern) => pattern.message)
    .join(" ")

  return [
    lastThree.length > 0
      ? `${scopePrefix}${lastThree.join(" | ")}`
      : input.scopeLabel === "this week only"
        ? "No live trades logged this week yet."
        : input.scopeLabel === "last trades from Vyronis journal"
          ? "No trades in your Vyronis journal yet — tap Log on HQ after your next close."
          : "No live trades logged yet.",
    patterns ? `Patterns: ${patterns}` : null,
  ]
    .filter(Boolean)
    .join(" ")
}

function buildRexContext(input: {
  accountName: string
  balance: number
  startingBalance: number
  currency: string
  drawdownPct: number
  maxDrawdownLimit: number
  dailyLossLimitPct: number
  todayLossPct: number
  maxLossToday: number
  todayJournalLine: string
  maxTradesPerWeek: number
  tradesThisWeek: number
  tradesRemaining: number
  lossStreak: number
  lossStreakLimit: number
  rulesSnapshot: Awaited<ReturnType<typeof getTradingRulesSnapshot>>
  calendarRexLine?: string | null
}): string {
  const status = input.rulesSnapshot?.cooldownRequired
    ? "Cooldown active — paper only until Coach unlock."
    : input.rulesSnapshot?.weeklyLimitReached
      ? "Weekly live trade limit reached."
      : input.todayLossPct >= input.dailyLossLimitPct
        ? "Daily loss limit hit — stop trading for today."
        : "Within risk rules."

  return [
    `Account "${input.accountName}": balance ${formatMoney(input.balance, input.currency)} (starting ${formatMoney(input.startingBalance, input.currency)}).`,
    `Drawdown ${input.drawdownPct.toFixed(1)}% (max allowed ${input.maxDrawdownLimit}%).`,
    input.todayJournalLine,
    `Daily loss limit ${input.dailyLossLimitPct}% — ${input.todayLossPct.toFixed(1)}% used today (~${formatMoney(input.maxLossToday, input.currency)} budget).`,
    `Weekly trade limit ${input.maxTradesPerWeek} — ${input.tradesThisWeek} taken, ${input.tradesRemaining} remaining.`,
    `Loss streak ${input.lossStreak}/${input.lossStreakLimit} this week.`,
    status,
    input.rulesSnapshot?.blockReason,
    input.calendarRexLine,
  ]
    .filter(Boolean)
    .join(" ")
}

function buildLunaContext(input: {
  warPlan: WeeklyPlanWithPairs | null
  evaluationsByPair: Map<string, SetupEvaluationRow>
  evaluationsByPlanId: Map<string, SetupEvaluationRow>
}): string {
  if (!input.warPlan?.pairs.length) {
    return "War Room watchlist empty — add pairs in War Room before the session."
  }

  const watchlist = input.warPlan.pairs
    .map((pair) => {
      const evalRow =
        input.evaluationsByPlanId.get(pair.id) ??
        input.evaluationsByPair.get(pair.pair.replace(/\s/g, "").toUpperCase())
      const grade = evalRow?.grade ? `grade ${evalRow.grade}` : "grade pending"
      const zone =
        pair.aoi_low != null && pair.aoi_high != null
          ? `H4 zone ${pair.aoi_low}-${pair.aoi_high}`
          : "H4 zone pending"
      return `${normalizeForexPairSymbol(pair.pair)} ${pair.directional_bias}, ${pair.aoi_status}, ${zone}, ${grade}`
    })
    .join(" · ")

  const opportunities = input.warPlan.pairs
    .filter((pair) => isActiveOpportunity(pair.aoi_status))
    .map((pair) => {
      const evalRow =
        input.evaluationsByPlanId.get(pair.id) ??
        input.evaluationsByPair.get(pair.pair.replace(/\s/g, "").toUpperCase())
      return `${normalizeForexPairSymbol(pair.pair)} (${pair.aoi_status}${evalRow?.grade ? `, ${evalRow.grade}` : ""})`
    })

  return [
    `War Room watchlist: ${watchlist}.`,
    opportunities.length > 0
      ? `Active opportunities: ${opportunities.join(", ")}.`
      : "Active opportunities: none in zone yet — all pairs WAITING or invalidated.",
  ].join(" ")
}

function buildCipherContext(input: {
  warPlan: WeeklyPlanWithPairs | null
  biasEval: ReturnType<typeof evaluateMarketBias> | null
  evaluationsByPair: Map<string, SetupEvaluationRow>
  evaluationsByPlanId: Map<string, SetupEvaluationRow>
}): string {
  if (!input.warPlan?.pairs.length) {
    return "No War Room pairs to confirm — save pair plans with AOI and bias first."
  }

  const htfSummary = input.biasEval
    ? `HTF bias: Weekly ${input.biasEval.weekly_bias}, Daily ${input.biasEval.daily_bias}, H4 ${input.biasEval.h4_bias}. ${input.biasEval.alignment_summary}. Permission ${input.biasEval.directional_permission ? "yes" : "no"}.`
    : "HTF bias not set — run War Room bias panel."

  const pairLines = input.warPlan.pairs.slice(0, 5).map((pair) =>
    formatCipherPairLine(pair, input.biasEval, input.evaluationsByPlanId, input.evaluationsByPair),
  )

  return [htfSummary, ...pairLines].join(" | ")
}

function formatCipherPairLine(
  pair: PairPlanRecord,
  biasEval: ReturnType<typeof evaluateMarketBias> | null,
  evaluationsByPlanId: Map<string, SetupEvaluationRow>,
  evaluationsByPair: Map<string, SetupEvaluationRow>,
): string {
  const evalRow =
    evaluationsByPlanId.get(pair.id) ??
    evaluationsByPair.get(pair.pair.replace(/\s/g, "").toUpperCase())
  const h4Zone =
    pair.aoi_low != null && pair.aoi_high != null
      ? `H4 zone ${pair.aoi_low}-${pair.aoi_high}`
      : "H4 zone pending"
  const apex = formatApexFilterStatus({
    directionalPermission: biasEval?.directional_permission ?? false,
    setupValid: biasEval?.setup_valid ?? false,
    grade: evalRow?.grade ?? null,
    recommendation: evalRow?.recommendation ?? null,
    conflictSummary: biasEval?.conflict_summary ?? null,
  })
  const m15 = formatM15ConfirmationStatus(pair.aoi_status, evalRow?.confirmation, null)

  return `${normalizeForexPairSymbol(pair.pair)}: Apex filter ${apex}. ${h4Zone}. Bias ${pair.directional_bias}, AOI ${pair.aoi_status}. ${m15}.${pair.invalidation != null ? ` Invalidation ${pair.invalidation}.` : ""}`
}

function buildTradeChartsFromRows(
  tradeRows: TradeRow[],
  labelSuffix: string,
): Array<{ pair: string; url: string; label: string }> {
  const charts: Array<{ pair: string; url: string; label: string }> = []
  const seen = new Set<string>()
  for (const trade of tradeRows) {
    if (charts.length >= 3) break
    const resolved = resolveSignalChartImageUrl({
      screenshot_url: trade.screenshot_url,
      chart_url: trade.chart_url,
    })
    if (!resolved.url || seen.has(resolved.url)) continue
    seen.add(resolved.url)
    charts.push({
      pair: String(trade.pair ?? "—"),
      url: resolved.url,
      label: `${trade.pair ?? "Trade"} · ${labelSuffix}`,
    })
  }
  return charts
}

export async function loadCouncilAgentContext(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  options?: { dataScope?: CouncilDataScope },
): Promise<CouncilAgentContext> {
  const dataScope = options?.dataScope ?? "all_time"
  const weekStart = toWeekStartISO(new Date())

  const { data: accountRows } = await supabase
    .from("accounts")
    .select("id, created_at")
    .eq("user_id", userId)
  const legacyAccountId = resolveLegacyTradeAccountId(accountRows ?? [])

  const [
    traderProfile,
    account,
    rulesSnapshot,
    settingsRow,
    dashboard,
    marketBias,
    weeklySummaries,
    setupEvaluations,
    recentEmotionChecks,
    startingBalanceFromAccount,
  ] = await Promise.all([
    loadTraderProfile(supabase, userId),
    getTradingAccount(supabase, userId, accountId),
    getTradingRulesSnapshot(supabase, userId, accountId),
      supabase
        .from("user_settings")
        .select(
          "starting_balance, daily_drawdown_limit, max_risk_per_trade, max_trades_per_day, preferred_session",
        )
        .eq("user_id", userId)
        .maybeSingle(),
    getWeeklyChapterDashboard(supabase, userId, accountId, {
      traderFirstName: undefined,
    }).catch(() => null),
    getMarketBias(supabase, userId).catch(() => null),
    listWeeklySummaries(supabase, userId, accountId, legacyAccountId, 8).catch(() => []),
    loadSetupEvaluations(supabase, userId),
    loadRecentEmotionChecks(supabase, userId),
    fetchUserStartingBalance(supabase, userId, accountId),
  ])

  const { allJournalRows, tradeRows, loadError } = await loadCouncilJournalTrades(
    supabase,
    userId,
    accountId,
    legacyAccountId,
  )

  const settings = normalizeUserSettings(settingsRow.data)
  const firstName = traderProfile.firstName
  const timeZone = traderProfile.timeZone
  const preferredSession = normalizePreferredSession(settings.preferred_session)
  const startingBalance =
    account?.starting_balance ?? startingBalanceFromAccount ?? settings.starting_balance
  const currency = account?.currency ?? "USD"
  const chapterNumber = dashboard?.chapterNumber ?? 1
  const chapterLabel = formatChapterTitle(chapterNumber, weekStart)

  const weekTrades = tradeRows.filter((row) =>
    isTradeInWeekStart(
      {
        trade_date: row.trade_date != null ? String(row.trade_date) : null,
        created_at: row.created_at != null ? String(row.created_at) : null,
      },
      weekStart,
    ),
  )

  const disciplineByTradeId = await loadDisciplineScoresByTradeId(
    supabase,
    userId,
    tradeRows.slice(0, 12).map((row) => String(row.id)),
  )

  const settingsTrades = mapTradeRowsToSettingsTrades(tradeRows, startingBalance)
  const dataNote = buildCouncilDataNote(
    tradeRows,
    allJournalRows,
    accountId,
    legacyAccountId,
    loadError,
  )

  const accountStatus = evaluateAccountStatus({
    trades: settingsTrades,
    account: account ?? {
      name: "Trading account",
      starting_balance: startingBalance,
      max_drawdown_pct: 10,
      currency,
      max_trades_per_week: 2,
    },
    settings,
    timeZone,
  })

  const balance = accountStatus.accountBalance
  const drawdownPct = accountStatus.drawdownPercent
  const maxLossToday = (startingBalance * settings.daily_drawdown_limit) / 100
  const todayJournalLine = buildTodayRexJournalLine(tradeRows, timeZone, currency, startingBalance)

  const riskSnapshot = buildRiskSnapshot(
    settings,
    settingsTrades,
    startingBalance,
    timeZone,
  )

  const maxTrades =
    rulesSnapshot?.rules.max_trades_per_week ?? account?.max_trades_per_week ?? 2

  const currentSummary: WeeklySummaryRecord | null =
    weeklySummaries.find((summary) => summary.week_start === weekStart) ??
    (dashboard?.thisWeek
      ? ({
          id: "",
          user_id: userId,
          account_id: accountId,
          week_start: weekStart,
          chapter_number: chapterNumber,
          trades_taken: dashboard.thisWeek.tradesTaken,
          wins: dashboard.thisWeek.wins,
          losses: dashboard.thisWeek.losses,
          win_rate: dashboard.thisWeek.winRate,
          pnl: dashboard.thisWeek.pnl,
          discipline_score: dashboard.thisWeek.disciplineScore,
          discipline_grade: dashboard.thisWeek.disciplineGrade,
          key_lesson: dashboard.carryForwardMessage ?? "",
          is_winning_chapter: dashboard.thisWeek.pnl > 0,
          max_trades_allowed: maxTrades,
          summary_payload: {},
          created_at: "",
          updated_at: "",
        } satisfies WeeklySummaryRecord)
      : null)

  const resolvedDiscipline = resolveCurrentWeekDiscipline(weeklySummaries, weekStart)
  const disciplineScore =
    currentSummary?.discipline_score ??
    resolvedDiscipline.score ??
    dashboard?.thisWeek.disciplineScore ??
    null
  const disciplineGrade =
    currentSummary?.discipline_grade ??
    resolvedDiscipline.grade ??
    dashboard?.thisWeek.disciplineGrade ??
    null

  const emotionSummary = buildChapterEmotionSummary({
    trades: weekTrades.map(mapTradeForPatterns),
    disciplineByTradeId,
    summaryDisciplineScore: disciplineScore,
  })

  const coachWeekDiscipline = averageCoachDisciplineForTrades(weekTrades, disciplineByTradeId)
  const inferredDiscipline =
    coachWeekDiscipline ?? emotionSummary?.disciplineAverage ?? null
  const effectiveDisciplineScore = disciplineScore ?? inferredDiscipline
  const effectiveDisciplineGrade =
    disciplineGrade ??
    (effectiveDisciplineScore != null
      ? disciplineGradeFromScore(effectiveDisciplineScore)
      : null)
  const disciplineScoreNote =
    disciplineScore == null && effectiveDisciplineScore != null
      ? coachWeekDiscipline != null
        ? "Estimated from Coach reviews on this week's trades — save your weekly chapter to lock the official score."
        : "Estimated from this week's journal trades — run Coach on each trade or complete your weekly review for the official score."
      : disciplineScore == null && weekTrades.length > 0
        ? "No discipline score yet — run Coach on your trades or complete the weekly chapter review."
        : null

  const evaluationsByPair = latestEvaluationsByPair(setupEvaluations)
  const evaluationsByPlanId = latestEvaluationsByPlanId(setupEvaluations)

  let warPlan: WeeklyPlanWithPairs | null = null
  const warPlanCandidates = await Promise.all(
    warRoomWeekStartCandidates(weekStart).map((candidate) =>
      getWeeklyPlanWithPairs(supabase, userId, candidate).catch(() => null),
    ),
  )
  warPlan = warPlanCandidates.find((plan) => plan && plan.pairs.length > 0) ?? null

  const biasEval = marketBias
    ? evaluateMarketBias({
        weekly_bias: marketBias.weekly_bias,
        daily_bias: marketBias.daily_bias,
        h4_bias: marketBias.h4_bias,
      })
    : null

  const tradesRemaining = rulesSnapshot?.tradesRemainingThisWeek ?? Math.max(0, maxTrades - weekTrades.length)
  const tradesThisWeek = weekTrades.length

  const economicCalendar = await getTodayCalendarSnapshot().catch(() => null)
  const calendarRexLine = buildRexCalendarLine(economicCalendar)

  const nova = buildNovaContext({
    chapterLabel,
    currentSummary:
      currentSummary != null
        ? {
            ...currentSummary,
            discipline_score: effectiveDisciplineScore,
            discipline_grade: effectiveDisciplineGrade,
          }
        : null,
    dashboardDisciplineScore: effectiveDisciplineScore,
    dashboardDisciplineGrade: effectiveDisciplineGrade,
    weekTrades,
    maxTrades,
    tradesRemaining,
    previousChapter: dashboard?.previousChapter ?? null,
    emotionSummary,
    recentEmotionChecks,
    disciplineByTradeId,
  })

  const tradesForZara =
    dataScope === "this_week"
      ? weekTrades
      : dataScope === "last_trades"
        ? tradeRows.slice(0, COUNCIL_JOURNAL_LAST_TRADES_LIMIT)
        : tradeRows
  const zaraScopeLabel =
    dataScope === "this_week"
      ? "this week only"
      : dataScope === "last_trades"
        ? "last trades from Vyronis journal"
        : "recent journal"
  const zara = buildZaraContext({
    tradeRows: tradesForZara,
    disciplineByTradeId,
    scopeLabel: zaraScopeLabel,
  })
  const rex = buildRexContext({
    accountName: account?.name ?? "Trading account",
    balance,
    startingBalance,
    currency,
    drawdownPct,
    maxDrawdownLimit: account?.max_drawdown_pct ?? 10,
    dailyLossLimitPct: settings.daily_drawdown_limit,
    todayLossPct: riskSnapshot.todayLossPercent,
    maxLossToday,
    todayJournalLine,
    maxTradesPerWeek: maxTrades,
    tradesThisWeek,
    tradesRemaining,
    lossStreak: rulesSnapshot?.lossStreak ?? 0,
    lossStreakLimit: rulesSnapshot?.rules.loss_streak_limit ?? account?.loss_streak_limit ?? 3,
    rulesSnapshot,
    calendarRexLine,
  })
  const luna = buildLunaContext({ warPlan, evaluationsByPair, evaluationsByPlanId })
  const cipher = buildCipherContext({
    warPlan,
    biasEval,
    evaluationsByPair,
    evaluationsByPlanId,
  })

  const jarvis = buildJarvisContextSnapshot({
    traderFirstName: firstName,
    preferredSession,
    chapterLabel,
  })

  const watchlistCharts = (warPlan?.pairs ?? [])
    .map((pair) => {
      const url = pickBestWarRoomScreenshot(pair.screenshot_urls ?? [])
      if (!url || !isDirectImageUrl(url)) return null
      return {
        pair: pair.pair,
        url,
        label: `${pair.pair} · War Room`,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .slice(0, 3)

  const chartTradeSource =
    dataScope === "this_week"
      ? weekTrades
      : dataScope === "last_trades"
        ? tradeRows.slice(0, COUNCIL_JOURNAL_LAST_TRADE_CHARTS_LIMIT)
        : tradeRows
  const chartLabelSuffix =
    dataScope === "this_week"
      ? "This week"
      : dataScope === "last_trades"
        ? "Journal"
        : "Logged"
  const lastTrade = chartTradeSource[0]
  const lastTradeResolved = lastTrade
    ? resolveSignalChartImageUrl({
        screenshot_url: lastTrade.screenshot_url,
        chart_url: lastTrade.chart_url,
      })
    : { url: null as string | null }
  const lastTradeChart =
    lastTrade && lastTradeResolved.url
      ? {
          pair: String(lastTrade.pair ?? "—"),
          url: lastTradeResolved.url,
          label: `${lastTrade.pair ?? "Trade"} · ${chartLabelSuffix}`,
        }
      : null

  const recentTradeCharts = buildTradeChartsFromRows(chartTradeSource, chartLabelSuffix)

  const visual = {
    stats: {
      balance,
      startingBalance,
      targetBalance: accountStatus.targetBalance,
      targetProgressPercent: accountStatus.targetProgressPercent,
      totalPnL: accountStatus.totalPnL,
      currency,
      drawdownPct,
      dailyLossPct: riskSnapshot.todayLossPercent,
      tradesThisWeek,
      maxTradesPerWeek: maxTrades,
      tradesRemaining,
      disciplineScore: effectiveDisciplineScore,
      disciplineGrade: effectiveDisciplineGrade,
      disciplineScoreNote,
      chapterLabel,
      accountName: account?.name ?? "Trading account",
      todayJournalLine,
      dataNote,
    },
    watchlistCharts,
    lastTradeChart,
    recentTradeCharts,
    economicCalendar,
  }

  return {
    jarvis,
    nova,
    zara,
    rex,
    luna,
    cipher,
    traderFirstName: firstName,
    chapterNumber,
    chapterLabel,
    preferredSession,
    visual,
    economicCalendar,
  }
}

export function isCouncilMorningWindow(now = new Date()): boolean {
  return now.getHours() < 12
}
