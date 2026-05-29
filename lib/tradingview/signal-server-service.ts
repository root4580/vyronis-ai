import type { SupabaseClient } from "@supabase/supabase-js"
import { getAppBaseUrl } from "@/lib/env"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import { slimTradingViewSignalListItem } from "@/lib/tradingview/slim-signal-list-analysis"
import type { TradingViewSignalListItem, TradingViewSignalRecord } from "@/lib/tradingview/types"

export class TradingViewSignalsTableMissingError extends Error {
  constructor(message = "Run supabase/RUN-TRADINGVIEW-SIGNALS.sql in Supabase SQL Editor, then retry.") {
    super(message)
    this.name = "TradingViewSignalsTableMissingError"
  }
}

function isMissingTableError(message: string): boolean {
  return /tradingview_signals|does not exist|PGRST205/i.test(message)
}

const LIST_COLUMNS =
  "id, symbol, timeframe, direction, strategy_name, message, ai_confidence_score, ai_recommendation, ai_analysis, coach_session_id, read_at, received_at, status"

export async function listTradingViewSignals(
  supabase: SupabaseClient,
  userId: string,
  options: { limit?: number; unreadOnly?: boolean } = {},
): Promise<TradingViewSignalListItem[]> {
  const limit = options.limit ?? 20
  let query = supabase
    .from("tradingview_signals")
    .select(LIST_COLUMNS)
    .eq("user_id", userId)
    .in("status", ["new", "analyzed", "converted"])
    .order("received_at", { ascending: false })
    .limit(limit)

  if (options.unreadOnly) {
    query = query.is("read_at", null)
  }

  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error.message)) throw new TradingViewSignalsTableMissingError()
    throw new Error(error.message)
  }

  return ((data ?? []) as TradingViewSignalListItem[]).map(slimTradingViewSignalListItem)
}

export async function countUnreadTradingViewSignals(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("tradingview_signals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)
    .in("status", ["new", "analyzed", "converted"])

  if (error) {
    if (isMissingTableError(error.message)) return 0
    throw new Error(error.message)
  }

  return count ?? 0
}

export async function markTradingViewSignalRead(
  supabase: SupabaseClient,
  userId: string,
  signalId: string,
): Promise<void> {
  const { error } = await supabase
    .from("tradingview_signals")
    .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", signalId)

  if (error) {
    if (isMissingTableError(error.message)) throw new TradingViewSignalsTableMissingError()
    throw new Error(error.message)
  }
}

export async function archiveTradingViewSignal(
  supabase: SupabaseClient,
  userId: string,
  signalId: string,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("tradingview_signals")
    .update({
      status: "archived",
      archived_at: now,
      updated_at: now,
    })
    .eq("user_id", userId)
    .eq("id", signalId)

  if (error) {
    if (isMissingTableError(error.message)) throw new TradingViewSignalsTableMissingError()
    throw new Error(error.message)
  }
}

export async function markAllTradingViewSignalsRead(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("tradingview_signals")
    .update({ read_at: now, updated_at: now })
    .eq("user_id", userId)
    .is("read_at", null)

  if (error) {
    if (isMissingTableError(error.message)) throw new TradingViewSignalsTableMissingError()
    throw new Error(error.message)
  }
}

export async function getTradingViewSignal(
  supabase: SupabaseClient,
  userId: string,
  signalId: string,
): Promise<TradingViewSignalRecord | null> {
  const { data, error } = await supabase
    .from("tradingview_signals")
    .select("*")
    .eq("user_id", userId)
    .eq("id", signalId)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error.message)) throw new TradingViewSignalsTableMissingError()
    throw new Error(error.message)
  }

  return (data as TradingViewSignalRecord) || null
}

export async function ensureTradingViewWebhookSettings(
  supabase: SupabaseClient,
  userId: string,
  baseUrl: string = getAppBaseUrl(),
): Promise<{ secret: string; enabled: boolean; webhookUrl: string }> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("tradingview_webhook_secret, tradingview_webhook_enabled")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error.message)) throw new TradingViewSignalsTableMissingError()
    throw new Error(error.message)
  }

  let secret = data?.tradingview_webhook_secret
  let enabled = data?.tradingview_webhook_enabled ?? false

  if (!secret) {
    const { generateWebhookSecret } = await import("@/lib/tradingview/webhook-server-service")
    secret = generateWebhookSecret()
    enabled = true

    const { error: upsertError } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        ...DEFAULT_USER_SETTINGS,
        tradingview_webhook_secret: secret,
        tradingview_webhook_enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

    if (upsertError) throw new Error(upsertError.message)
  } else if (!enabled) {
    const { error: enableError } = await supabase
      .from("user_settings")
      .update({ tradingview_webhook_enabled: true, updated_at: new Date().toISOString() })
      .eq("user_id", userId)

    if (enableError) throw new Error(enableError.message)
    enabled = true
  }

  return {
    secret,
    enabled,
    webhookUrl: `${baseUrl}/api/webhooks/tradingview`,
  }
}

export async function regenerateTradingViewWebhookSecret(
  supabase: SupabaseClient,
  userId: string,
  baseUrl: string = getAppBaseUrl(),
): Promise<{ secret: string; enabled: boolean; webhookUrl: string }> {
  const { generateWebhookSecret } = await import("@/lib/tradingview/webhook-server-service")
  const secret = generateWebhookSecret()

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      ...DEFAULT_USER_SETTINGS,
      tradingview_webhook_secret: secret,
      tradingview_webhook_enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )

  if (error) throw new Error(error.message)

  return {
    secret,
    enabled: true,
    webhookUrl: `${baseUrl}/api/webhooks/tradingview`,
  }
}
