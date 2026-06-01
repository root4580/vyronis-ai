import type { SupabaseClient } from "@supabase/supabase-js"
import type { AnalyticsTradeRow } from "@/lib/analytics/types"
import { filterTradesByScope } from "@/lib/analytics/trade-scope"
import { accountScopeOrFilter } from "@/lib/accounts/server-active-account"
import type { AnalyticsTradeScope } from "@/lib/research/types"

export async function fetchUserTradesForAnalytics(
  supabase: SupabaseClient,
  userId: string,
  scope: AnalyticsTradeScope = "manual",
  options?: {
    accountId?: string | null
    legacyAccountId?: string | null
  },
): Promise<{ trades: AnalyticsTradeRow[]; error: string | null }> {
  let query = supabase.from("trades").select("*").eq("user_id", userId)

  if (options?.accountId) {
    query = query.or(
      accountScopeOrFilter(options.accountId, options.legacyAccountId ?? null),
    )
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    if (/account_id|column .* does not exist/i.test(error.message)) {
      const fallback = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (fallback.error) {
        return { trades: [], error: fallback.error.message }
      }

      let rows = filterTradesByScope((fallback.data ?? []) as AnalyticsTradeRow[], scope)
      if (options?.accountId) {
        rows = rows.filter(
          (trade) =>
            trade.account_id === options.accountId ||
            (!trade.account_id &&
              options.legacyAccountId &&
              options.accountId === options.legacyAccountId),
        )
      }
      return { trades: rows, error: null }
    }

    return { trades: [], error: error.message }
  }

  return {
    trades: filterTradesByScope((data ?? []) as AnalyticsTradeRow[], scope),
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
