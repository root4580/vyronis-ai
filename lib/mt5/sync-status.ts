import type { SupabaseClient } from "@supabase/supabase-js"

export type Mt5SyncStatus = "ok" | "duplicate" | "error"

export type Mt5SyncSnapshot = {
  lastSyncAt: string | null
  lastSyncStatus: Mt5SyncStatus | null
  lastSyncTicket: string | null
  lastSyncMessage: string | null
}

const SYNC_COLUMNS =
  "mt5_last_sync_at, mt5_last_sync_status, mt5_last_sync_ticket, mt5_last_sync_message, mt5_webhook_enabled, mt5_last_ping_at, mt5_account_login, mt5_broker, mt5_balance, mt5_last_error"

const SYNC_COLUMNS_FALLBACK = "mt5_webhook_enabled, mt5_webhook_api_key"

function isMissingSyncColumns(message: string): boolean {
  return /mt5_last_sync|mt5_last_ping|mt5_account_login|mt5_balance|does not exist|PGRST205/i.test(message)
}

export type Mt5ConnectionMeta = {
  lastPingAt: string | null
  accountLogin: string | null
  broker: string | null
  balance: number | null
  lastError: string | null
}

export async function recordMt5Sync(
  supabase: SupabaseClient,
  userId: string,
  params: {
    status: Mt5SyncStatus
    ticket?: string
    message?: string
  },
): Promise<void> {
  const { error } = await supabase
    .from("user_settings")
    .update({
      mt5_last_sync_at: new Date().toISOString(),
      mt5_last_sync_status: params.status,
      mt5_last_sync_ticket: params.ticket?.trim() || null,
      mt5_last_sync_message: params.message?.trim().slice(0, 500) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)

  if (error && !isMissingSyncColumns(error.message)) {
    console.warn("[MT5 Sync] could not record last sync:", error.message)
  }
}

export async function fetchMt5SyncSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<Mt5SyncSnapshot & Mt5ConnectionMeta & { webhookEnabled: boolean }> {
  let data: Record<string, unknown> | null = null

  const full = await supabase.from("user_settings").select(SYNC_COLUMNS).eq("user_id", userId).maybeSingle()

  if (full.error && isMissingSyncColumns(full.error.message)) {
    const minimal = await supabase
      .from("user_settings")
      .select(SYNC_COLUMNS_FALLBACK)
      .eq("user_id", userId)
      .maybeSingle()
    if (minimal.error) throw new Error(minimal.error.message)
    data = minimal.data as Record<string, unknown> | null
  } else {
    if (full.error) throw new Error(full.error.message)
    data = full.data as Record<string, unknown> | null
  }

  const balanceRaw = data?.mt5_balance
  const balance =
    balanceRaw != null && Number.isFinite(Number(balanceRaw)) ? Number(balanceRaw) : null

  return {
    webhookEnabled: Boolean(data?.mt5_webhook_enabled),
    lastSyncAt: (data?.mt5_last_sync_at as string | null) ?? null,
    lastSyncStatus: (data?.mt5_last_sync_status as Mt5SyncStatus | null) ?? null,
    lastSyncTicket: (data?.mt5_last_sync_ticket as string | null) ?? null,
    lastSyncMessage: (data?.mt5_last_sync_message as string | null) ?? null,
    lastPingAt: (data?.mt5_last_ping_at as string | null) ?? null,
    accountLogin: (data?.mt5_account_login as string | null) ?? null,
    broker: (data?.mt5_broker as string | null) ?? null,
    balance,
    lastError: (data?.mt5_last_error as string | null) ?? null,
  }
}

export type Mt5ConnectionState = "connected" | "waiting" | "error" | "disabled" | "unknown"

const OFFLINE_MS = 10 * 60 * 1000

export function deriveMt5ConnectionState(
  snapshot: Mt5SyncSnapshot &
    Mt5ConnectionMeta & { webhookEnabled: boolean; settingsEnabled?: boolean },
): Mt5ConnectionState {
  const enabled = snapshot.settingsEnabled ?? snapshot.webhookEnabled
  if (!enabled) return "disabled"

  const lastActivity = snapshot.lastSyncAt ?? snapshot.lastPingAt
  if (!lastActivity) return "waiting"

  const ageMs = Date.now() - new Date(lastActivity).getTime()
  const online = ageMs < OFFLINE_MS

  if (snapshot.lastSyncStatus === "error" && online) return "error"
  if ((snapshot.lastSyncStatus === "ok" || snapshot.lastSyncStatus === "duplicate") && online) {
    return "connected"
  }
  if (snapshot.lastPingAt && online) return "connected"
  if (ageMs < 48 * 60 * 60 * 1000) return "waiting"
  return "waiting"
}
