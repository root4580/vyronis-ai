import type { SupabaseClient } from "@supabase/supabase-js"

export type Mt5PingPayload = {
  api_key?: string
  ping?: boolean
  test?: boolean
  account_login?: string | number
  broker?: string
  balance?: number
  equity?: number
  terminal?: string
  ea_version?: string
}

function isMissingMetaColumns(message: string): boolean {
  return /mt5_last_ping|mt5_account_login|mt5_balance|does not exist|PGRST205/i.test(message)
}

export async function recordMt5Ping(
  supabase: SupabaseClient,
  userId: string,
  payload: Mt5PingPayload,
  message = "MT5 ping received.",
): Promise<void> {
  const login =
    payload.account_login != null ? String(payload.account_login).trim() : null
  const broker = payload.broker?.trim() || null
  const balance =
    payload.balance != null && Number.isFinite(Number(payload.balance))
      ? Number(payload.balance)
      : null

  const { error } = await supabase
    .from("user_settings")
    .update({
      mt5_webhook_enabled: true,
      mt5_last_ping_at: new Date().toISOString(),
      mt5_last_sync_at: new Date().toISOString(),
      mt5_last_sync_status: "ok",
      mt5_last_sync_ticket: null,
      mt5_last_sync_message: message,
      mt5_account_login: login,
      mt5_broker: broker,
      mt5_balance: balance,
      mt5_last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)

  if (error && !isMissingMetaColumns(error.message)) {
    console.warn("[MT5 Ping] record failed:", error.message)
    await supabase
      .from("user_settings")
      .update({
        mt5_webhook_enabled: true,
        mt5_last_sync_at: new Date().toISOString(),
        mt5_last_sync_status: "ok",
        mt5_last_sync_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
  }
}

export async function recordMt5WebhookError(
  supabase: SupabaseClient,
  userId: string,
  message: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_settings")
    .update({
      mt5_last_sync_at: new Date().toISOString(),
      mt5_last_sync_status: "error",
      mt5_last_sync_message: message.slice(0, 500),
      mt5_last_error: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)

  if (error) console.warn("[MT5 Sync] error record failed:", error.message)
}
