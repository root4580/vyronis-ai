import type { SupabaseClient } from "@supabase/supabase-js"
import type { AnalyticsTradeRow } from "@/lib/analytics/types"
import {
  filterTradesByScope,
  journalTradesOrFilter,
  researchTradesOrFilter,
} from "@/lib/analytics/trade-scope"
import type { AnalyticsTradeScope } from "@/lib/research/types"

export async function fetchUserTradesForAnalytics(
  supabase: SupabaseClient,
  userId: string,
  scope: AnalyticsTradeScope = "manual",
): Promise<{ trades: AnalyticsTradeRow[]; error: string | null }> {
  let query = supabase.from("trades").select("*").eq("user_id", userId)

  if (scope === "manual") {
    query = query.or(journalTradesOrFilter())
  } else if (scope === "research") {
    query = query.or(researchTradesOrFilter())
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    if (/import_source|research_strategy_id|column .* does not exist/i.test(error.message)) {
      const fallback = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (fallback.error) {
        return { trades: [], error: fallback.error.message }
      }

      return {
        trades: filterTradesByScope((fallback.data ?? []) as AnalyticsTradeRow[], scope),
        error: null,
      }
    }

    return { trades: [], error: error.message }
  }

  return { trades: (data ?? []) as AnalyticsTradeRow[], error: null }
}

export async function fetchUserStartingBalance(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data } = await supabase
    .from("user_settings")
    .select("starting_balance")
    .eq("user_id", userId)
    .maybeSingle()

  const balance = data?.starting_balance
  return typeof balance === "number" && balance > 0 ? balance : 10000
}
