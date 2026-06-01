import type { SupabaseClient } from "@supabase/supabase-js"
import { ensureDefaultTradingAccount } from "@/lib/accounts/trading-account-service"
import { parseDashboardPreferences } from "@/lib/user-preferences"

export async function resolveActiveAccountId(
  supabase: SupabaseClient,
  userId: string,
  request?: Request,
): Promise<string | null> {
  const fromQuery = request ? new URL(request.url).searchParams.get("accountId")?.trim() : null
  if (fromQuery) return fromQuery

  const { data: settings } = await supabase
    .from("user_settings")
    .select("dashboard_preferences")
    .eq("user_id", userId)
    .maybeSingle()

  const preferences = parseDashboardPreferences(settings?.dashboard_preferences)
  if (preferences.activeAccountId) {
    return preferences.activeAccountId
  }

  const { data: defaultAccount } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle()

  if (defaultAccount?.id) {
    return String(defaultAccount.id)
  }

  try {
    const created = await ensureDefaultTradingAccount(supabase, userId)
    return created.id
  } catch {
    return null
  }
}

export async function resolveDefaultAccountId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle()

  return data?.id ? String(data.id) : null
}

/** Oldest account holds legacy rows with null account_id (pre-migration trades). */
export async function resolveLegacyTradeAccountId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  return data?.id ? String(data.id) : null
}

/** Supabase filter: rows for active account; legacy null rows belong to oldest account only. */
export function accountScopeOrFilter(
  accountId: string,
  legacyAccountId: string | null,
): string {
  if (legacyAccountId && accountId === legacyAccountId) {
    return `account_id.eq.${accountId},account_id.is.null`
  }
  return `account_id.eq.${accountId}`
}
