import type { SupabaseClient } from "@supabase/supabase-js"
import { getAppBaseUrl } from "@/lib/env"
import {
  deriveMt5ConnectionState,
  fetchMt5SyncSnapshot,
  type Mt5ConnectionState,
} from "@/lib/mt5/sync-status"
import {
  generateMt5ApiKey,
  Mt5WebhookTableMissingError,
} from "@/lib/mt5/webhook-server-service"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"

export type Mt5SettingsPayload = {
  apiKey: string
  enabled: boolean
  webhookUrl: string
  pingUrl: string
  echoUrl: string
  connection: Mt5ConnectionState
  lastSyncAt: string | null
  lastPingAt: string | null
  lastSyncStatus: "ok" | "duplicate" | "error" | null
  lastSyncTicket: string | null
  lastSyncMessage: string | null
  accountLogin: string | null
  broker: string | null
  balance: number | null
  lastError: string | null
  diagnostics?: string[]
}

function isMissingTableError(message: string): boolean {
  return /mt5_webhook|does not exist|PGRST205/i.test(message)
}

async function buildMt5SettingsResponse(
  supabase: SupabaseClient,
  userId: string,
  apiKey: string,
  enabled: boolean,
): Promise<Mt5SettingsPayload> {
  const sync = await fetchMt5SyncSnapshot(supabase, userId)
  const base = getAppBaseUrl()
  const diagnostics: string[] = []
  if (!sync.lastSyncAt && !sync.lastPingAt) {
    diagnostics.push(
      "No MT5 traffic yet. EA WebRequest URL must match webhook host (localhost vs production).",
    )
  }
  if (!sync.webhookEnabled && enabled) {
    diagnostics.push("Webhook flag was off in DB — re-enabled on load.")
  }

  return {
    apiKey,
    enabled,
    webhookUrl: `${base}/api/webhooks/mt5/trades`,
    pingUrl: `${base}/api/webhooks/mt5/ping`,
    echoUrl: `${base}/api/webhooks/mt5/echo`,
    connection: deriveMt5ConnectionState({ ...sync, settingsEnabled: enabled }),
    lastSyncAt: sync.lastSyncAt,
    lastPingAt: sync.lastPingAt,
    lastSyncStatus: sync.lastSyncStatus,
    lastSyncTicket: sync.lastSyncTicket,
    lastSyncMessage: sync.lastSyncMessage,
    accountLogin: sync.accountLogin,
    broker: sync.broker,
    balance: sync.balance,
    lastError: sync.lastError,
    diagnostics: diagnostics.length ? diagnostics : undefined,
  }
}

export async function ensureMt5WebhookSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<Mt5SettingsPayload> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("mt5_webhook_api_key, mt5_webhook_enabled")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error.message)) throw new Mt5WebhookTableMissingError()
    throw new Error(error.message)
  }

  let apiKey = data?.mt5_webhook_api_key
  let enabled = data?.mt5_webhook_enabled ?? false

  if (!apiKey) {
    apiKey = generateMt5ApiKey()
    enabled = true

    const { error: upsertError } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        ...DEFAULT_USER_SETTINGS,
        mt5_webhook_api_key: apiKey,
        mt5_webhook_enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

    if (upsertError) throw new Error(upsertError.message)
  } else if (!enabled) {
    const { error: enableError } = await supabase
      .from("user_settings")
      .update({ mt5_webhook_enabled: true, updated_at: new Date().toISOString() })
      .eq("user_id", userId)

    if (enableError) throw new Error(enableError.message)
    enabled = true
  }

  return buildMt5SettingsResponse(supabase, userId, apiKey, enabled)
}

export async function regenerateMt5WebhookApiKey(
  supabase: SupabaseClient,
  userId: string,
): Promise<Mt5SettingsPayload> {
  const apiKey = generateMt5ApiKey()

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      ...DEFAULT_USER_SETTINGS,
      mt5_webhook_api_key: apiKey,
      mt5_webhook_enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )

  if (error) {
    if (isMissingTableError(error.message)) throw new Mt5WebhookTableMissingError()
    throw new Error(error.message)
  }

  return buildMt5SettingsResponse(supabase, userId, apiKey, true)
}
