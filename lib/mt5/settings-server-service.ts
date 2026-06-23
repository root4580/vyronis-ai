import type { SupabaseClient } from "@supabase/supabase-js"
import { getAppBaseUrl } from "@/lib/env"
import { createServiceRoleClient } from "@/lib/supabase/admin"
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
  scannerUrl: string
  scannerStateUrl: string
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

const SCANNER_ONLINE_MS = 10 * 60 * 1000

async function fetchScannerLastActivity(userId: string): Promise<string | null> {
  try {
    const admin = createServiceRoleClient()
    const { data, error } = await admin
      .from("scanner_pair_state")
      .select("last_scan_at")
      .eq("user_id", userId)
      .order("last_scan_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data?.last_scan_at) return null
    return data.last_scan_at as string
  } catch {
    return null
  }
}

async function buildMt5SettingsResponse(
  supabase: SupabaseClient,
  userId: string,
  apiKey: string,
  enabled: boolean,
  baseUrl: string = getAppBaseUrl(),
): Promise<Mt5SettingsPayload> {
  const admin = createServiceRoleClient()
  const sync = await fetchMt5SyncSnapshot(admin, userId)
  const base = baseUrl
  const diagnostics: string[] = []

  let lastSyncAt = sync.lastSyncAt
  let lastSyncMessage = sync.lastSyncMessage
  let lastSyncStatus = sync.lastSyncStatus

  const scannerAt = await fetchScannerLastActivity(userId)
  if (scannerAt) {
    const ageMs = Date.now() - new Date(scannerAt).getTime()
    if (ageMs < SCANNER_ONLINE_MS) {
      const scannerNewer =
        !lastSyncAt || new Date(scannerAt).getTime() > new Date(lastSyncAt).getTime()
      if (scannerNewer) {
        lastSyncAt = scannerAt
        lastSyncMessage = `A+ Scanner watchlist sync active.`
        lastSyncStatus = "ok"
      }
    }
  }

  if (!lastSyncAt && !sync.lastPingAt) {
    diagnostics.push(
      "No MT5 traffic yet. Attach Vyronis_APlus_Scanner with API key and whitelist https://vyronishq.com in MT5 WebRequest.",
    )
  } else if (!sync.lastSyncAt && !sync.lastPingAt && scannerAt) {
    diagnostics.push(
      "Scanner watchlist is syncing but run supabase/024-mt5-sync-status.sql for full MT5 status columns.",
    )
  }
  if (!sync.webhookEnabled && enabled) {
    diagnostics.push("Webhook flag was off in DB — re-enabled on load.")
  }

  return {
    apiKey,
    enabled,
    webhookUrl: `${base}/api/webhooks/mt5/trades`,
    scannerUrl: `${base}/api/webhooks/mt5/scanner`,
    scannerStateUrl: `${base}/api/webhooks/mt5/scanner/state`,
    pingUrl: `${base}/api/webhooks/mt5/ping`,
    echoUrl: `${base}/api/webhooks/mt5/echo`,
    connection: deriveMt5ConnectionState({
      ...sync,
      lastSyncAt,
      lastSyncStatus,
      settingsEnabled: enabled,
    }),
    lastSyncAt,
    lastPingAt: sync.lastPingAt,
    lastSyncStatus,
    lastSyncTicket: sync.lastSyncTicket,
    lastSyncMessage,
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
  baseUrl: string = getAppBaseUrl(),
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

  return buildMt5SettingsResponse(supabase, userId, apiKey, enabled, baseUrl)
}

export async function regenerateMt5WebhookApiKey(
  supabase: SupabaseClient,
  userId: string,
  baseUrl: string = getAppBaseUrl(),
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

  return buildMt5SettingsResponse(supabase, userId, apiKey, true, baseUrl)
}
