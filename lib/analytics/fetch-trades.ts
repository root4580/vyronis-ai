import type { SupabaseClient } from "@supabase/supabase-js"
import type { AnalyticsTradeRow } from "@/lib/analytics/types"
import { filterTradesByScope } from "@/lib/analytics/trade-scope"
import { accountScopeOrFilter } from "@/lib/accounts/server-active-account"
import type { AnalyticsTradeScope } from "@/lib/research/types"

/**
 * PostgREST (Supabase's API layer) caps unpaginated selects at 1000 rows by
 * default. A plain `.select("*")` with no `.range()` silently truncates any
 * account past that — analytics (win rate, equity curve, etc.) would be
 * quietly wrong for active traders instead of erroring. This page size is
 * used to page through with `.range()` until a page comes back short.
 */
const ANALYTICS_FETCH_PAGE_SIZE = 1000

/** Safety cap on total pages fetched, so a runaway account can't hang the request. */
const ANALYTICS_FETCH_MAX_PAGES = 50

async function fetchAllTradeRows(
  supabase: SupabaseClient,
  userId: string,
  options?: { accountId?: string | null; legacyAccountId?: string | null },
): Promise<{ rows: AnalyticsTradeRow[]; error: string | null }> {
  const rows: AnalyticsTradeRow[] = []

  for (let page = 0; page < ANALYTICS_FETCH_MAX_PAGES; page++) {
    const from = page * ANALYTICS_FETCH_PAGE_SIZE
    const to = from + ANALYTICS_FETCH_PAGE_SIZE - 1

    let query = supabase.from("trades").select("*").eq("user_id", userId)
    if (options?.accountId) {
      query = query.or(
        accountScopeOrFilter(options.accountId, options.legacyAccountId ?? null),
      )
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to)

    if (error) {
      return { rows, error: error.message }
    }

    const batch = (data ?? []) as AnalyticsTradeRow[]
    rows.push(...batch)

    if (batch.length < ANALYTICS_FETCH_PAGE_SIZE) {
      // Short page — this was the last one.
      break
    }
  }

  return { rows, error: null }
}

export async function fetchUserTradesForAnalytics(
  supabase: SupabaseClient,
  userId: string,
  scope: AnalyticsTradeScope = "manual",
  options?: {
    accountId?: string | null
    legacyAccountId?: string | null
  },
): Promise<{ trades: AnalyticsTradeRow[]; error: string | null }> {
  const { rows, error } = await fetchAllTradeRows(supabase, userId, options)

  if (error) {
    if (/account_id|column .* does not exist/i.test(error)) {
      const fallback = await fetchAllTradeRows(supabase, userId)

      if (fallback.error) {
        return { trades: [], error: fallback.error }
      }

      let filteredRows = filterTradesByScope(fallback.rows, scope)
      if (options?.accountId) {
        filteredRows = filteredRows.filter(
          (trade) =>
            trade.account_id === options.accountId ||
            (!trade.account_id &&
              options.legacyAccountId &&
              options.accountId === options.legacyAccountId),
        )
      }
      return { trades: filteredRows, error: null }
    }

    return { trades: [], error }
  }

  return {
    trades: filterTradesByScope(rows, scope),
    error: null,
  }
}

export async function fetchUserStartingBalance(
  supabase: SupabaseClient,
  userId: string,
  accountId?: string | null,
): Promise<number> {
  if (accountId) {
    const { data: account } = await supabase
      .from("accounts")
      .select("starting_balance")
      .eq("user_id", userId)
      .eq("id", accountId)
      .maybeSingle()

    const balance = account?.starting_balance
    if (typeof balance === "number" && balance > 0) return balance
  }

  const { data } = await supabase
    .from("user_settings")
    .select("starting_balance")
    .eq("user_id", userId)
    .maybeSingle()

  const balance = data?.starting_balance
  return typeof balance === "number" && balance > 0 ? balance : 10000
}
