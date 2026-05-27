import type { SupabaseClient } from "@supabase/supabase-js"
import type { AnalyticsTradeRow } from "@/lib/analytics/types"

export async function fetchUserTradesForAnalytics(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ trades: AnalyticsTradeRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
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
