import type { SupabaseClient } from "@supabase/supabase-js"
import { isJournalTrade } from "@/lib/analytics/trade-scope"
import {
  accountScopeOrFilter,
  resolveLegacyTradeAccountId,
} from "@/lib/accounts/server-active-account"
import { getTradingAccount } from "@/lib/accounts/trading-account-service"
import type { CouncilAgentContext } from "@/lib/council/types"
import { detectChapterReviewPatterns } from "@/lib/weekly-chapters/chapter-patterns"
import { buildChapterTradeReviewNotes } from "@/lib/weekly-chapters/trade-review-notes"
import { getWeeklyChapterDashboard } from "@/lib/weekly-chapters/server-service"
import { formatChapterTitle } from "@/lib/weekly-chapters/week-utils"
import { warRoomWeekStartCandidates } from "@/lib/weekly-chapters/chapter-war-room-recap"
import { getMarketBias, getWeeklyPlanWithPairs } from "@/lib/strategy-brain/server-service"
import { evaluateMarketBias } from "@/lib/strategy-brain/market-bias-engine"
import { getTradingRulesSnapshot } from "@/lib/trading-rules/trading-rules-service"
import { getSignedPnL } from "@/lib/trade-utils"
import { normalizeUserSettings } from "@/lib/user-settings"
import { isTradeInWeekStart, toWeekStartISO } from "@/lib/weekly-chapters/week-utils"

async function loadTraderFirstName(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("user_profiles")
    .select("first_name")
    .eq("user_id", userId)
    .maybeSingle()
  return data?.first_name?.trim() || "Trader"
}

function formatMoney(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export async function loadCouncilAgentContext(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<CouncilAgentContext> {
  const legacyAccountId = await resolveLegacyTradeAccountId(supabase, userId)
  const [firstName, account, rulesSnapshot, settingsRow, tradesResult, dashboard, marketBias] =
    await Promise.all([
      loadTraderFirstName(supabase, userId),
      getTradingAccount(supabase, userId, accountId),
      getTradingRulesSnapshot(supabase, userId, accountId),
      supabase
        .from("user_settings")
        .select("starting_balance, daily_drawdown_limit, max_risk_per_trade")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("trades")
        .select(
          "id, pair, direction, result, pnl, emotion, session, rule_followed, mistake_tags, trade_date, created_at, import_source, entry_price, stop_loss, take_profit",
        )
        .eq("user_id", userId)
        .or(accountScopeOrFilter(accountId, legacyAccountId))
        .order("trade_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(120),
      getWeeklyChapterDashboard(supabase, userId, accountId, {
        traderFirstName: undefined,
      }).catch(() => null),
      getMarketBias(supabase, userId).catch(() => null),
    ])

  const settings = normalizeUserSettings(settingsRow.data)
  const startingBalance = account?.starting_balance ?? settings.starting_balance
  const currency = account?.currency ?? "USD"
  const weekStart = toWeekStartISO(new Date())
  const chapterNumber = dashboard?.chapterNumber ?? 1
  const chapterLabel = formatChapterTitle(chapterNumber, weekStart)

  const tradeRows = (tradesResult.data ?? []).filter((row) =>
    isJournalTrade({ import_source: row.import_source as string | null }),
  )

  const weekTrades = tradeRows.filter((row) =>
    isTradeInWeekStart(
      {
        trade_date: row.trade_date != null ? String(row.trade_date) : null,
        created_at: row.created_at != null ? String(row.created_at) : null,
      },
      weekStart,
    ),
  )

  const totalPnl = tradeRows.reduce(
    (sum, row) => sum + getSignedPnL(Number(row.pnl ?? 0), String(row.result ?? "")),
    0,
  )
  const balance = startingBalance + totalPnl
  let peak = startingBalance
  let running = startingBalance
  for (const row of [...tradeRows].reverse()) {
    running += getSignedPnL(Number(row.pnl ?? 0), String(row.result ?? ""))
    peak = Math.max(peak, running)
  }
  const drawdownPct = peak > 0 ? ((peak - balance) / peak) * 100 : 0
  const maxLossToday = (startingBalance * settings.daily_drawdown_limit) / 100

  const previousChapter = dashboard?.previousChapter
  const tradesRemaining = rulesSnapshot?.tradesRemainingThisWeek ?? 0
  const maxTrades = rulesSnapshot?.rules.max_trades_per_week ?? account?.max_trades_per_week ?? 2

  const nova = [
    `${chapterLabel} is active.`,
    `Live trades this week: ${weekTrades.length}/${maxTrades}. Slots remaining: ${tradesRemaining}.`,
    previousChapter
      ? `Last chapter: ${previousChapter.trades_taken} trades, ${previousChapter.win_rate}% win, P&L ${previousChapter.pnl.toFixed(0)}. Key lesson: ${previousChapter.key_lesson || "Protect process."}`
      : "This is your first chapter window — focus on process over outcome.",
    dashboard?.thisWeekPaper
      ? `Practice Room: ${dashboard.thisWeekPaper.total} paper trades, ${dashboard.thisWeekPaper.winRate}% win.`
      : null,
  ]
    .filter(Boolean)
    .join(" ")

  const lastThree = tradeRows.slice(0, 3).map((row) => {
    const notes = buildChapterTradeReviewNotes({
      result: String(row.result ?? "—"),
      pnl: getSignedPnL(Number(row.pnl ?? 0), String(row.result ?? "")),
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
    return `${row.pair} ${row.direction} ${row.result} (${row.emotion || "no emotion"}) — right: ${notes.whatWentRight || "n/a"}; wrong: ${notes.whatWentWrong || "n/a"}`
  })

  const mappedForPatterns = tradeRows.slice(0, 12).map((row) => ({
    id: String(row.id),
    pair: String(row.pair ?? "—"),
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
  }))
  const patterns = detectChapterReviewPatterns(mappedForPatterns)
    .map((pattern) => pattern.message)
    .join(" ")

  const zara = [
    lastThree.length > 0 ? `Last trades: ${lastThree.join(" | ")}` : "No live trades logged yet.",
    patterns ? `Patterns: ${patterns}` : null,
  ]
    .filter(Boolean)
    .join(" ")

  const rex = [
    `Balance ${formatMoney(balance, currency)} (starting ${formatMoney(startingBalance, currency)}).`,
    `Drawdown ${drawdownPct.toFixed(1)}%.`,
    rulesSnapshot?.cooldownRequired
      ? "Cooldown active — paper only until Coach unlock."
      : rulesSnapshot?.weeklyLimitReached
        ? "Weekly live trade limit reached."
        : `Safe to trade within rules. Max daily loss budget ~${formatMoney(maxLossToday, currency)}.`,
    `${rulesSnapshot?.weeklyUsageLabel ?? `${weekTrades.length}/${maxTrades} trades this week`}.`,
  ].join(" ")

  let warPlan = null
  for (const candidate of warRoomWeekStartCandidates(weekStart)) {
    warPlan = await getWeeklyPlanWithPairs(supabase, userId, candidate).catch(() => null)
    if (warPlan && warPlan.pairs.length > 0) break
  }

  const luna = warPlan?.pairs.length
    ? warPlan.pairs
        .map((pair) => {
          const zone =
            pair.aoi_low != null && pair.aoi_high != null
              ? `zone ${pair.aoi_low}-${pair.aoi_high}`
              : "zone pending"
          return `${pair.pair} bias ${pair.directional_bias}, ${pair.aoi_status}, ${zone}`
        })
        .join(" · ")
    : "No War Room watchlist saved this week — add pairs in War Room before the session."

  const biasEval = marketBias
    ? evaluateMarketBias({
        weekly_bias: marketBias.weekly_bias,
        daily_bias: marketBias.daily_bias,
        h4_bias: marketBias.h4_bias,
      })
    : null

  const cipherPairs = (warPlan?.pairs ?? []).slice(0, 4).map((pair) => {
    const htf = biasEval
      ? `Weekly ${biasEval.weekly_bias}, Daily ${biasEval.daily_bias}, H4 ${biasEval.h4_bias} — ${biasEval.alignment_summary}`
      : "HTF bias not set — run War Room bias panel."
    return `${pair.pair}: ${htf} Pair plan ${pair.directional_bias}. AOI ${pair.aoi_status}. ${pair.invalidation != null ? `Invalidation ${pair.invalidation}.` : ""}`
  })

  const cipher =
    cipherPairs.length > 0
      ? cipherPairs.join(" | ")
      : "No setups to confirm — save War Room pair plans with AOI and bias first."

  return {
    nova,
    zara,
    rex,
    luna,
    cipher,
    traderFirstName: firstName,
    chapterNumber,
    chapterLabel,
  }
}

export function isCouncilMorningWindow(now = new Date()): boolean {
  return now.getHours() < 12
}
