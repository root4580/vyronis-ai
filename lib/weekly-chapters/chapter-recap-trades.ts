import type { SupabaseClient } from "@supabase/supabase-js"
import { isJournalTrade } from "@/lib/analytics/trade-scope"
import { accountScopeOrFilter } from "@/lib/accounts/server-active-account"
import { getSignedPnL } from "@/lib/trade-utils"
import type { ChapterReviewTrade } from "@/lib/weekly-chapters/types"
import { isTradeInWeekStart } from "@/lib/weekly-chapters/week-utils"

export async function fetchChapterReviewTradeRows(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  legacyAccountId: string | null,
): Promise<Array<Record<string, unknown>>> {
  let query = supabase
    .from("trades")
    .select(
      "id, pair, direction, result, pnl, session, emotion, entry_price, stop_loss, take_profit, screenshot_url, trade_date, created_at, import_source, rule_followed, mistake_tags",
    )
    .eq("user_id", userId)
    .order("trade_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(400)

  query = query.or(accountScopeOrFilter(accountId, legacyAccountId))

  const { data, error } = await query
  let rows = (data ?? []) as Array<Record<string, unknown>>

  if (error) {
    if (/account_id|column/i.test(error.message)) {
      const fallback = await supabase
        .from("trades")
        .select(
          "id, pair, direction, result, pnl, session, emotion, entry_price, stop_loss, take_profit, screenshot_url, trade_date, created_at, import_source, rule_followed, mistake_tags",
        )
        .eq("user_id", userId)
        .limit(400)
      rows = (fallback.data ?? []) as Array<Record<string, unknown>>
    } else {
      throw new Error(error.message)
    }
  }

  return rows.filter((row) =>
    isJournalTrade({ import_source: row.import_source as string | null | undefined }),
  )
}

export function mapChapterRecapTrades(
  rows: Array<Record<string, unknown>>,
  weekStart: string,
): ChapterReviewTrade[] {
  return rows
    .filter((row) =>
      isTradeInWeekStart(
        {
          trade_date: row.trade_date != null ? String(row.trade_date) : null,
          created_at: row.created_at != null ? String(row.created_at) : null,
        },
        weekStart,
      ),
    )
    .map((row) => ({
      id: String(row.id),
      pair: String(row.pair ?? row.symbol ?? "—"),
      direction: String(row.direction ?? "—"),
      result: String(row.result ?? "—"),
      pnl: getSignedPnL(Number(row.pnl ?? 0), String(row.result ?? "")),
      session: row.session != null ? String(row.session) : null,
      emotion: row.emotion != null ? String(row.emotion) : null,
      entry_price: row.entry_price != null ? Number(row.entry_price) : null,
      stop_loss: row.stop_loss != null ? Number(row.stop_loss) : null,
      take_profit: row.take_profit != null ? Number(row.take_profit) : null,
      screenshot_url: row.screenshot_url != null ? String(row.screenshot_url) : null,
      chart_url: row.screenshot_url != null ? String(row.screenshot_url) : null,
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
    .sort((a, b) => (b.trade_date ?? "").localeCompare(a.trade_date ?? ""))
}
