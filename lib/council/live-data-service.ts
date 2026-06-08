import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateAccountStatus } from "@/lib/account-status"
import { filterRowsForAccount, resolveLegacyTradeAccountId } from "@/lib/accounts/account-query"
import { formatAccountMoney } from "@/lib/accounts/profit-target"
import { getTradingAccount } from "@/lib/accounts/trading-account-service"
import {
  COUNCIL_JOURNAL_LAST_TRADES_LIMIT,
  type CouncilDataScope,
} from "@/lib/council/data-scope"
import type { CouncilAgentId } from "@/lib/council/types"
import { loadCouncilCoachLiveData } from "@/lib/council/coach-live-data"
import { fetchUserStartingBalance, fetchUserTradesForAnalytics } from "@/lib/analytics/fetch-trades"
import { isJournalTrade } from "@/lib/analytics/trade-scope"
import { normalizeForexPairSymbol } from "@/lib/council/forex-pair-format"
import { formatPairForSpeech } from "@/lib/economic-calendar/pair-impact"
import { getTodayCalendarSnapshot } from "@/lib/economic-calendar/service"
import { evaluateMarketBias } from "@/lib/strategy-brain/market-bias-engine"
import { getMarketBias, getWeeklyPlanWithPairs } from "@/lib/strategy-brain/server-service"
import type {
  ConfirmationChecklist,
  PairPlanRecord,
  SetupGrade,
  TradeRecommendation,
  WeeklyPlanWithPairs,
} from "@/lib/strategy-brain/types"
import { getTradingRulesSnapshot } from "@/lib/trading-rules/trading-rules-service"
import { formatPnL, getSignedPnL } from "@/lib/trade-utils"
import {
  normalizeUserSettings,
  resolveTradingDayTimeZone,
  type SettingsTrade,
} from "@/lib/user-settings"
import { listWeeklySummaries } from "@/lib/weekly-chapters/server-service"
import type { WeeklySummaryRecord } from "@/lib/weekly-chapters/types"
import { formatWeekOfLabel, isTradeInWeekStart, toWeekStartISO } from "@/lib/weekly-chapters/week-utils"
import { warRoomWeekStartCandidates } from "@/lib/weekly-chapters/chapter-war-room-recap"

type TradeRow = {
  id: string
  pair: string | null
  direction: string | null
  result: string | null
  pnl: number | null
  entry_price: number | null
  stop_loss: number | null
  take_profit: number | null
  trade_notes: string | null
  created_at: string | null
  trade_date: string | null
  import_source: string | null
  account_id: string | null
  screenshot_url?: string | null
  chart_url?: string | null
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

export type CouncilLiveDataBundle = {
  traderFirstName: string
  shared: string
  watchlist: string
  watchlistCipher: string
  lastTrades: string
  lastChapters: string
  novaChapters: string
  rexRisk: string
  coachShared: string
  coachNova: string
  coachZara: string
  coachRex: string
  coachLuna: string
  coachCipher: string
  coachJarvis: string
  jarvisFull: string
}

const GRADE_RANK: Record<string, number> = { "A+": 5, A: 4, B: 3, C: 2, D: 1 }

function formatMoney(value: number, currency = "USD"): string {
  return formatAccountMoney(value, currency)
}

function formatZone(pair: PairPlanRecord): string {
  if (pair.aoi_low != null) return String(pair.aoi_low)
  if (pair.aoi_high != null) return String(pair.aoi_high)
  return "—"
}

function biasToDirection(bias: string): string {
  if (bias === "Bullish") return "BUY"
  if (bias === "Bearish") return "SELL"
  return "NEUTRAL"
}

function formatApexPassed(input: {
  directionalPermission: boolean
  setupValid: boolean
  grade: SetupGrade | null
  recommendation: TradeRecommendation | null
  conflictSummary: string | null
}): string {
  const htfPass = input.directionalPermission && input.setupValid
  const gradePass = input.grade === "A+" || input.grade === "B"
  if (htfPass && gradePass && input.recommendation === "TAKE") return "PASS"
  if (htfPass && gradePass) return "PASS"
  if (htfPass) return "PARTIAL"
  return "FAIL"
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

function latestEvaluationsByPair(evaluations: SetupEvaluationRow[]): Map<string, SetupEvaluationRow> {
  const map = new Map<string, SetupEvaluationRow>()
  for (const row of evaluations) {
    const key = row.pair.replace(/\s/g, "").toUpperCase()
    if (!map.has(key)) map.set(key, row)
  }
  return map
}

function mapTradeToSettings(row: TradeRow, startingBalance: number): SettingsTrade {
  const result = String(row.result ?? "")
  let pnl = Number(row.pnl ?? 0)
  if (
    (result === "LOSS" || result === "BE") &&
    pnl === 0 &&
    row.entry_price != null &&
    row.stop_loss != null
  ) {
    pnl = -Math.abs(Number(row.entry_price) - Number(row.stop_loss))
  }
  return {
    result,
    pnl,
    trade_date: row.trade_date,
    created_at: row.created_at ?? new Date().toISOString(),
    emotion: "",
    risk_percent: null,
    rule_followed: null,
    stop_loss: row.stop_loss,
  }
}

function summarizeTradeNote(row: TradeRow): string {
  const notes = row.trade_notes?.trim()
  if (notes) return notes.slice(0, 80)
  if (row.result === "LOSS") return "Entry early"
  if (row.result === "WIN") return "Process followed"
  return "—"
}

function formatDisciplineLabel(
  grade: string | null | undefined,
  score: number | null | undefined,
): string {
  if (grade && score != null) return `${grade} (${Math.round(score)})`
  if (grade) return grade
  if (score != null) return `${Math.round(score)}/100`
  return "—"
}

function formatNewsTime(timeLabel: string): string {
  return timeLabel.replace(/\sAM ET$/i, " ET").replace(/\sPM ET$/i, " ET")
}

async function loadRecentTrades(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  legacyAccountId: string | null,
): Promise<TradeRow[]> {
  const { data } = await supabase
    .from("trades")
    .select(
      "id, pair, direction, result, pnl, entry_price, stop_loss, take_profit, trade_notes, created_at, trade_date, import_source, account_id",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(120)

  const rows = (data ?? [])
    .filter((row) => isJournalTrade({ import_source: row.import_source }))
    .map((row) => row as TradeRow)

  if (rows.length === 0) {
    const allResult = await fetchUserTradesForAnalytics(supabase, userId)
    const mapped = allResult.trades
      .filter((row) => isJournalTrade(row))
      .map((row) => ({
        id: String(row.id),
        pair: row.pair ?? null,
        direction: row.direction ?? null,
        result: row.result ?? null,
        pnl: row.pnl ?? null,
        entry_price: row.entry_price ?? null,
        stop_loss: row.stop_loss ?? null,
        take_profit: row.take_profit ?? null,
        trade_notes: (row as { trade_notes?: string | null }).trade_notes ?? null,
        created_at: row.created_at ?? null,
        trade_date: row.trade_date ?? null,
        import_source: row.import_source ?? null,
        account_id: row.account_id ?? null,
      }))
    return filterRowsForAccount(mapped, accountId, legacyAccountId).slice(0, 3)
  }

  return filterRowsForAccount(rows, accountId, legacyAccountId).slice(0, 3)
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

export async function loadCouncilLiveDataBundle(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  options?: { dataScope?: CouncilDataScope },
): Promise<CouncilLiveDataBundle> {
  const dataScope = options?.dataScope ?? "all_time"
  const weekStart = toWeekStartISO(new Date())

  const { data: accountRows } = await supabase.from("accounts").select("id, created_at").eq("user_id", userId)
  const legacyAccountId = resolveLegacyTradeAccountId(accountRows ?? [])

  const [
    profileRow,
    account,
    settingsRow,
    rulesSnapshot,
    weeklySummariesRaw,
    setupEvaluations,
    marketBias,
    calendar,
    startingBalanceFromAccount,
    recentTrades,
  ] = await Promise.all([
    supabase.from("user_profiles").select("first_name, timezone").eq("user_id", userId).maybeSingle(),
    getTradingAccount(supabase, userId, accountId),
    supabase
      .from("user_settings")
      .select("starting_balance, daily_drawdown_limit, max_risk_per_trade, max_trades_per_day, profit_target")
      .eq("user_id", userId)
      .maybeSingle(),
    getTradingRulesSnapshot(supabase, userId, accountId),
    supabase
      .from("weekly_summaries")
      .select("*")
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(2),
    loadSetupEvaluations(supabase, userId),
    getMarketBias(supabase, userId).catch(() => null),
    getTodayCalendarSnapshot(),
    fetchUserStartingBalance(supabase, userId, accountId),
    loadRecentTrades(supabase, userId, accountId, legacyAccountId),
  ])

  let weeklySummaries: WeeklySummaryRecord[] = (weeklySummariesRaw.data ?? []) as WeeklySummaryRecord[]
  if (weeklySummariesRaw.error) {
    weeklySummaries = await listWeeklySummaries(supabase, userId, accountId, legacyAccountId, 2).catch(() => [])
  }

  const allResult = await fetchUserTradesForAnalytics(supabase, userId)
  const allJournalRows = allResult.trades
    .filter((row) => isJournalTrade(row))
    .map((row) => ({
      id: String(row.id),
      pair: row.pair ?? null,
      direction: row.direction ?? null,
      result: row.result ?? null,
      pnl: row.pnl ?? null,
      entry_price: row.entry_price ?? null,
      stop_loss: row.stop_loss ?? null,
      take_profit: row.take_profit ?? null,
      trade_notes: (row as { trade_notes?: string | null }).trade_notes ?? null,
      created_at: row.created_at ?? null,
      trade_date: row.trade_date ?? null,
      import_source: row.import_source ?? null,
      account_id: row.account_id ?? null,
      screenshot_url: (row as { screenshot_url?: string | null }).screenshot_url ?? null,
      chart_url: (row as { chart_url?: string | null }).chart_url ?? null,
    }))
  const accountTrades = filterRowsForAccount(allJournalRows, accountId, legacyAccountId)

  function mapJournalTradeForPrompt(row: TradeRow) {
    return {
      id: row.id,
      pair: row.pair,
      direction: row.direction,
      result: row.result,
      pnl: row.pnl,
      entry_price: row.entry_price,
      stop_loss: row.stop_loss,
      take_profit: row.take_profit,
      trade_notes: row.trade_notes,
      created_at: row.created_at,
      trade_date: row.trade_date,
      import_source: row.import_source,
      account_id: row.account_id,
      screenshot_url: row.screenshot_url ?? null,
      chart_url: row.chart_url ?? null,
    }
  }

  const settings = normalizeUserSettings(settingsRow.data)
  const traderFirstName = profileRow.data?.first_name?.trim() || "Trader"
  const timeZone = resolveTradingDayTimeZone(profileRow.data?.timezone)
  const startingBalance = account?.starting_balance ?? startingBalanceFromAccount ?? settings.starting_balance
  const currency = account?.currency ?? "USD"
  const maxTrades =
    rulesSnapshot?.rules.max_trades_per_week ?? account?.max_trades_per_week ?? 2
  const tradesThisWeek = rulesSnapshot?.tradesThisWeek ?? 0
  const tradesRemaining = rulesSnapshot?.tradesRemainingThisWeek ?? Math.max(0, maxTrades - tradesThisWeek)

  const settingsTrades = accountTrades.map((row) => mapTradeToSettings(row, startingBalance))
  const accountStatus = evaluateAccountStatus({
    trades: settingsTrades,
    account: account ?? {
      name: "Trading account",
      starting_balance: startingBalance,
      max_drawdown_pct: 10,
      currency,
      max_trades_per_week: maxTrades,
    },
    settings,
    timeZone,
  })

  const weekTrades = accountTrades.filter((row) =>
    isTradeInWeekStart(
      {
        trade_date: row.trade_date != null ? String(row.trade_date) : null,
        created_at: row.created_at != null ? String(row.created_at) : null,
      },
      weekStart,
    ),
  )
  const weekPnL = weekTrades.reduce(
    (sum, row) => sum + getSignedPnL(Number(row.pnl ?? 0), String(row.result ?? "")),
    0,
  )

  const currentSummary = weeklySummaries.find((row) => row.week_start === weekStart) ?? weeklySummaries[0]
  const chapterNumber = currentSummary?.chapter_number ?? 1
  const disciplineGrade = currentSummary?.discipline_grade ?? null
  const weeklyPnl = currentSummary?.pnl ?? weekPnL

  const warPlanCandidates = await Promise.all(
    warRoomWeekStartCandidates(weekStart).map((candidate) =>
      getWeeklyPlanWithPairs(supabase, userId, candidate).catch(() => null),
    ),
  )
  const warPlan: WeeklyPlanWithPairs | null =
    warPlanCandidates.find((plan) => plan && plan.pairs.length > 0) ?? null

  const biasEval = marketBias
    ? evaluateMarketBias({
        weekly_bias: marketBias.weekly_bias,
        daily_bias: marketBias.daily_bias,
        h4_bias: marketBias.h4_bias,
      })
    : null

  const evaluationsByPlanId = latestEvaluationsByPlanId(setupEvaluations)
  const evaluationsByPair = latestEvaluationsByPair(setupEvaluations)

  const pairs = [...(warPlan?.pairs ?? [])].sort((a, b) => {
    const evalA = evaluationsByPlanId.get(a.id) ?? evaluationsByPair.get(a.pair.replace(/\s/g, "").toUpperCase())
    const evalB = evaluationsByPlanId.get(b.id) ?? evaluationsByPair.get(b.pair.replace(/\s/g, "").toUpperCase())
    return (GRADE_RANK[evalB?.grade ?? ""] ?? 0) - (GRADE_RANK[evalA?.grade ?? ""] ?? 0)
  })

  const shared = [
    "[LIVE ACCOUNT DATA]",
    `Name: ${traderFirstName}`,
    `Balance: ${formatMoney(accountStatus.accountBalance, currency)}`,
    `Target: ${formatMoney(accountStatus.targetBalance, currency)}`,
    `Drawdown: ${accountStatus.drawdownPercent.toFixed(1)}% / ${accountStatus.maxDrawdownPercent}% max`,
    `Trades this week: ${tradesThisWeek}/${maxTrades}`,
    `Chapter: ${chapterNumber}`,
    `Weekly P&L: ${formatPnL(Math.abs(weeklyPnl), weeklyPnl >= 0 ? "WIN" : "LOSS")}`,
    `Discipline: ${formatDisciplineLabel(disciplineGrade, currentSummary?.discipline_score ?? null)}`,
  ].join("\n")

  const newsLines = calendar.events
    .filter((event) => event.impact === "high" && event.minutesUntil >= -60)
    .slice(0, 3)
    .map((event) => {
      const avoid = event.avoidPairs.slice(0, 3).map(formatPairForSpeech).join(", ")
      return `${formatNewsTime(event.time)} - ${event.currency} ${event.event} - HIGH IMPACT${avoid ? `\nAvoid: ${avoid}` : ""}`
    })

  const newsSection =
    newsLines.length > 0
      ? ["[TODAY'S NEWS]", ...newsLines].join("\n")
      : "[TODAY'S NEWS]\nNo high impact watchlist releases remaining today."

  const watchlistLines = pairs.slice(0, 6).map((pair) => {
    const evalRow =
      evaluationsByPlanId.get(pair.id) ??
      evaluationsByPair.get(pair.pair.replace(/\s/g, "").toUpperCase())
    const grade = evalRow?.grade ?? "—"
    return `${normalizeForexPairSymbol(pair.pair)} - ${biasToDirection(pair.directional_bias)} - ${grade} - Zone: ${formatZone(pair)}`
  })

  const watchlistSection =
    watchlistLines.length > 0
      ? ["[WATCHLIST]", ...watchlistLines].join("\n")
      : "[WATCHLIST]\nNo War Room pairs loaded — add watchlist in War Room."

  const watchlistCipherLines = pairs.slice(0, 6).map((pair) => {
    const evalRow =
      evaluationsByPlanId.get(pair.id) ??
      evaluationsByPair.get(pair.pair.replace(/\s/g, "").toUpperCase())
    const apex = formatApexPassed({
      directionalPermission: biasEval?.directional_permission ?? false,
      setupValid: biasEval?.setup_valid ?? false,
      grade: evalRow?.grade ?? null,
      recommendation: evalRow?.recommendation ?? null,
      conflictSummary: biasEval?.conflict_summary ?? null,
    })
    return `${normalizeForexPairSymbol(pair.pair)} - ${biasToDirection(pair.directional_bias)} - ${evalRow?.grade ?? "—"} - Apex: ${apex} - Zone: ${formatZone(pair)} - AOI: ${pair.aoi_status}`
  })

  const watchlistCipherSection =
    watchlistCipherLines.length > 0
      ? ["[WATCHLIST TECHNICAL]", ...watchlistCipherLines].join("\n")
      : "[WATCHLIST TECHNICAL]\nNo War Room pairs loaded."

  const tradeSource =
    dataScope === "this_week"
      ? weekTrades.slice(0, 3).map(mapJournalTradeForPrompt)
      : dataScope === "last_trades"
        ? accountTrades.slice(0, COUNCIL_JOURNAL_LAST_TRADES_LIMIT).map(mapJournalTradeForPrompt)
        : recentTrades

  const tradeLines = tradeSource.map((row, index) => {
    const pair = normalizeForexPairSymbol(String(row.pair ?? "—"))
    const direction = String(row.direction ?? "—").toUpperCase()
    const result = String(row.result ?? "—").toUpperCase()
    return `${index + 1}. ${pair} ${direction} - ${result} - ${summarizeTradeNote(row)}`
  })

  const lastTradesSection =
    dataScope === "this_week"
      ? tradeLines.length > 0
        ? ["[TRADES THIS WEEK]", ...tradeLines].join("\n")
        : "[TRADES THIS WEEK]\nNo trades logged this week yet."
      : dataScope === "last_trades"
        ? tradeLines.length > 0
          ? ["[LAST TRADES — VYRONIS JOURNAL]", ...tradeLines].join("\n")
          : "[LAST TRADES — VYRONIS JOURNAL]\nNo trades logged on this account yet — tap Log on HQ."
        : tradeLines.length > 0
          ? ["[LAST 3 TRADES]", ...tradeLines].join("\n")
          : "[LAST 3 TRADES]\nNo trades logged on this account yet."

  const previousChapter = weeklySummaries.find((row) => row.week_start !== weekStart) ?? weeklySummaries[1]
  const lastChapterSection =
    dataScope === "this_week"
      ? "[LAST CHAPTER]\nOmitted — trader asked about this week only."
      : previousChapter
        ? [
            "[LAST CHAPTER]",
            `${formatWeekOfLabel(previousChapter.week_start)} - ${previousChapter.trades_taken} trades - ${Math.round(previousChapter.win_rate)}% win`,
            `Lesson: ${previousChapter.key_lesson?.trim() || "Protect process."}`,
          ].join("\n")
        : "[LAST CHAPTER]\nFirst chapter — build steady habits."

  const chapterHistoryLines =
    dataScope === "this_week"
      ? currentSummary
        ? [
            `This week: ${formatWeekOfLabel(currentSummary.week_start)} - Ch.${currentSummary.chapter_number} - ${currentSummary.trades_taken} trades - ${Math.round(currentSummary.win_rate)}% win - P&L ${formatPnL(Math.abs(currentSummary.pnl), currentSummary.pnl >= 0 ? "WIN" : "LOSS")} - Discipline ${formatDisciplineLabel(currentSummary.discipline_grade, currentSummary.discipline_score)}${currentSummary.key_lesson?.trim() ? ` - Lesson: ${currentSummary.key_lesson.trim()}` : ""}`,
          ]
        : []
      : weeklySummaries.slice(0, 2).map((summary, index) => {
          const label = index === 0 ? "Latest" : "Previous"
          return `${label}: ${formatWeekOfLabel(summary.week_start)} - Ch.${summary.chapter_number} - ${summary.trades_taken} trades - ${Math.round(summary.win_rate)}% win - P&L ${formatPnL(Math.abs(summary.pnl), summary.pnl >= 0 ? "WIN" : "LOSS")} - Discipline ${formatDisciplineLabel(summary.discipline_grade, summary.discipline_score)}${summary.key_lesson?.trim() ? ` - Lesson: ${summary.key_lesson.trim()}` : ""}`
        })

  const novaChaptersSection =
    dataScope === "this_week"
      ? chapterHistoryLines.length > 0
        ? ["[THIS WEEK'S CHAPTER]", ...chapterHistoryLines].join("\n")
        : "[THIS WEEK'S CHAPTER]\nNo chapter summary saved for this week yet."
      : chapterHistoryLines.length > 0
        ? ["[WEEKLY CHAPTERS — last 2]", ...chapterHistoryLines].join("\n")
        : lastChapterSection

  const drawdownBudget = startingBalance * (accountStatus.maxDrawdownPercent / 100)

  const rexRiskSection = [
    "[REX RISK DETAIL]",
    `Drawdown: ${accountStatus.drawdownPercent.toFixed(1)}% / ${accountStatus.maxDrawdownPercent}% max`,
    `$ at risk to floor: ${formatMoney(accountStatus.amountAboveFloor, currency)}`,
    `Max drawdown budget: ${formatMoney(drawdownBudget, currency)}`,
    `Trades remaining this week: ${tradesRemaining}`,
    `Daily loss used today: ${accountStatus.dailyLossPercent.toFixed(1)}% / ${accountStatus.dailyLossLimitPercent}%`,
  ].join("\n")

  const coachData = await loadCouncilCoachLiveData(
    supabase,
    userId,
    accountId,
    tradeSource.map((row) => ({
      id: row.id,
      pair: row.pair,
      direction: row.direction,
      result: row.result,
    })),
    pairs.map((pair) => pair.pair),
  )

  const jarvisFull = [
    shared,
    newsSection,
    watchlistSection,
    lastTradesSection,
    lastChapterSection,
    watchlistCipherSection,
    rexRiskSection,
    coachData.jarvis,
  ].join("\n\n")

  return {
    traderFirstName,
    shared: `${shared}\n\n${newsSection}`,
    watchlist: watchlistSection,
    watchlistCipher: watchlistCipherSection,
    lastTrades: lastTradesSection,
    lastChapters: lastChapterSection,
    novaChapters: novaChaptersSection,
    rexRisk: rexRiskSection,
    coachShared: coachData.shared,
    coachNova: coachData.nova,
    coachZara: coachData.zara,
    coachRex: coachData.rex,
    coachLuna: coachData.luna,
    coachCipher: coachData.cipher,
    coachJarvis: coachData.jarvis,
    jarvisFull,
  }
}

export function buildCouncilAgentLivePrompt(
  agentId: CouncilAgentId,
  bundle: CouncilLiveDataBundle,
): string {
  const header =
    "LIVE SUPABASE DATA — quote these exact numbers in your reply. Never invent placeholders."

  const sections = [header, bundle.shared, bundle.coachShared]

  switch (agentId) {
    case "jarvis":
      sections.push(
        bundle.watchlist,
        bundle.lastTrades,
        bundle.novaChapters,
        bundle.watchlistCipher,
        bundle.rexRisk,
        bundle.coachJarvis,
      )
      break
    case "nova":
      sections.push(bundle.novaChapters, bundle.coachNova)
      break
    case "zara":
      sections.push(bundle.lastTrades, bundle.coachZara)
      break
    case "luna":
      sections.push(bundle.watchlist, bundle.coachLuna)
      break
    case "cipher":
      sections.push(bundle.watchlistCipher, bundle.coachCipher)
      break
    case "rex":
      sections.push(bundle.rexRisk, bundle.coachRex)
      break
    case "marcus":
      sections.push(bundle.novaChapters, bundle.lastTrades, bundle.coachShared)
      break
  }

  return sections.join("\n\n")
}
