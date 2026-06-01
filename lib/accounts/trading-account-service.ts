import type { SupabaseClient } from "@supabase/supabase-js"
import { pickAccentForIndex } from "@/lib/accounts/account-theme"
import type {
  TradingAccountInput,
  TradingAccountRecord,
  TradingAccountUpdate,
} from "@/lib/accounts/types"

export class TradingAccountsTableMissingError extends Error {
  constructor() {
    super(
      "Trading accounts table is missing. Run supabase/034-trading-accounts.sql in Supabase.",
    )
    this.name = "TradingAccountsTableMissingError"
  }
}

function isMissingTableError(message: string): boolean {
  return /accounts|relation .* does not exist|schema cache/i.test(message)
}

function normalizeAccountRow(row: Record<string, unknown>): TradingAccountRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    broker: String(row.broker ?? ""),
    starting_balance: Number(row.starting_balance),
    account_type: row.account_type === "personal" ? "personal" : "prop_firm",
    currency: String(row.currency ?? "USD"),
    max_drawdown_pct: Number(row.max_drawdown_pct ?? 10),
    starting_balance_locked: Boolean(row.starting_balance_locked),
    is_default: Boolean(row.is_default),
    accent_color: row.accent_color != null ? String(row.accent_color) : null,
    max_trades_per_week: Number(row.max_trades_per_week ?? 2),
    loss_streak_limit: Number(row.loss_streak_limit ?? 3),
    min_emotional_score: Number(row.min_emotional_score ?? 7),
    cooldown_active: Boolean(row.cooldown_active),
    cooldown_triggered_at:
      row.cooldown_triggered_at != null ? String(row.cooldown_triggered_at) : null,
    last_coach_unlock_at:
      row.last_coach_unlock_at != null ? String(row.last_coach_unlock_at) : null,
    last_coach_unlock_session_id:
      row.last_coach_unlock_session_id != null
        ? String(row.last_coach_unlock_session_id)
        : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function listTradingAccounts(
  supabase: SupabaseClient,
  userId: string,
): Promise<TradingAccountRecord[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })

  if (error) {
    if (isMissingTableError(error.message)) throw new TradingAccountsTableMissingError()
    throw new Error(error.message)
  }

  return (data ?? []).map(normalizeAccountRow)
}

export async function getTradingAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<TradingAccountRecord | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", accountId)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error.message)) throw new TradingAccountsTableMissingError()
    throw new Error(error.message)
  }

  return data ? normalizeAccountRow(data) : null
}

async function clearDefaultAccount(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase.from("accounts").update({ is_default: false }).eq("user_id", userId)
}

export async function createTradingAccount(
  supabase: SupabaseClient,
  userId: string,
  input: TradingAccountInput,
  options?: { makeDefault?: boolean },
): Promise<TradingAccountRecord> {
  const existing = await listTradingAccounts(supabase, userId)
  const makeDefault = options?.makeDefault ?? existing.length === 0

  if (makeDefault) {
    await clearDefaultAccount(supabase, userId)
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    name: input.name.trim(),
    broker: (input.broker ?? "").trim(),
    starting_balance: input.starting_balance,
    account_type: input.account_type ?? "prop_firm",
    currency: input.currency ?? "USD",
    max_drawdown_pct: input.max_drawdown_pct ?? 10,
    max_trades_per_week: input.max_trades_per_week ?? 2,
    loss_streak_limit: input.loss_streak_limit ?? 3,
    min_emotional_score: input.min_emotional_score ?? 7,
    accent_color: pickAccentForIndex(existing.length),
    is_default: makeDefault,
    updated_at: new Date().toISOString(),
  }

  let { data, error } = await supabase.from("accounts").insert(payload).select("*").single()

  if (error && /accent_color|column .* does not exist/i.test(error.message)) {
    const { accent_color: _accent, ...payloadWithoutAccent } = payload
    ;({ data, error } = await supabase
      .from("accounts")
      .insert(payloadWithoutAccent)
      .select("*")
      .single())
  }

  if (error) {
    if (isMissingTableError(error.message)) throw new TradingAccountsTableMissingError()
    if (/duplicate|unique/i.test(error.message)) {
      throw new Error("An account with this name already exists. Choose a different name.")
    }
    throw new Error(error.message)
  }

  if (!data) throw new Error("Account was not created")

  return normalizeAccountRow(data)
}

export async function updateTradingAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  patch: TradingAccountUpdate,
): Promise<TradingAccountRecord> {
  const current = await getTradingAccount(supabase, userId, accountId)
  if (!current) throw new Error("Account not found")

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (patch.name != null) updates.name = patch.name.trim()
  if (patch.broker != null) updates.broker = patch.broker.trim()
  if (patch.account_type != null) updates.account_type = patch.account_type
  if (patch.currency != null) updates.currency = patch.currency
  if (patch.max_drawdown_pct != null) updates.max_drawdown_pct = patch.max_drawdown_pct
  if (patch.max_trades_per_week != null) updates.max_trades_per_week = patch.max_trades_per_week
  if (patch.loss_streak_limit != null) updates.loss_streak_limit = patch.loss_streak_limit
  if (patch.min_emotional_score != null) updates.min_emotional_score = patch.min_emotional_score

  if (patch.starting_balance != null) {
    if (current.starting_balance_locked && patch.starting_balance !== current.starting_balance) {
      throw new Error("Starting balance is locked after the first logged trade")
    }
    updates.starting_balance = patch.starting_balance
  }

  if (patch.is_default === true) {
    await clearDefaultAccount(supabase, userId)
    updates.is_default = true
  }

  const { data, error } = await supabase
    .from("accounts")
    .update(updates)
    .eq("user_id", userId)
    .eq("id", accountId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return normalizeAccountRow(data)
}

export async function deleteTradingAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<void> {
  const accounts = await listTradingAccounts(supabase, userId)
  if (accounts.length <= 1) {
    throw new Error("You must keep at least one trading account")
  }

  const target = accounts.find((account) => account.id === accountId)
  if (!target) throw new Error("Account not found")

  const { count, error: countError } = await supabase
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("account_id", accountId)

  if (countError) throw new Error(countError.message)
  if ((count ?? 0) > 0) {
    throw new Error("Cannot delete an account with logged trades. Reassign trades first.")
  }

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("user_id", userId)
    .eq("id", accountId)

  if (error) throw new Error(error.message)

  if (target.is_default) {
    const remaining = accounts.filter((account) => account.id !== accountId)
    if (remaining[0]) {
      await updateTradingAccount(supabase, userId, remaining[0].id, { is_default: true })
    }
  }
}

export async function lockTradingAccountStartingBalance(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<void> {
  await supabase
    .from("accounts")
    .update({
      starting_balance_locked: true,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", accountId)
    .eq("starting_balance_locked", false)
}

export async function ensureDefaultTradingAccount(
  supabase: SupabaseClient,
  userId: string,
  fallbackStartingBalance = 10000,
): Promise<TradingAccountRecord> {
  const accounts = await listTradingAccounts(supabase, userId)
  if (accounts.length > 0) {
    return accounts.find((account) => account.is_default) ?? accounts[0]
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("starting_balance, prop_firm_size")
    .eq("user_id", userId)
    .maybeSingle()

  const startingBalance = Number(settings?.starting_balance ?? fallbackStartingBalance)
  const label = settings?.prop_firm_size ? `${settings.prop_firm_size} Account` : "Primary Account"

  return createTradingAccount(
    supabase,
    userId,
    {
      name: label,
      starting_balance: startingBalance,
      account_type: "prop_firm",
    },
    { makeDefault: true },
  )
}
