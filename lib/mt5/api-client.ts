export type Mt5ConnectionState = "connected" | "waiting" | "error" | "disabled" | "unknown"

export type Mt5SettingsResponse = {
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

export type Mt5TestConnectionResult = {
  ok: boolean
  steps: Array<{ step: string; ok: boolean; detail?: string; error?: string }>
  settings?: Mt5SettingsResponse
  hint?: string
}

export async function fetchMt5Settings(): Promise<Mt5SettingsResponse> {
  const res = await fetch("/api/mt5/settings", { credentials: "include" })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || "Could not load MT5 settings")
  }
  return body as Mt5SettingsResponse
}

export async function regenerateMt5ApiKey(): Promise<Mt5SettingsResponse> {
  const res = await fetch("/api/mt5/settings", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ regenerateApiKey: true }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || "Could not regenerate API key")
  }
  return body as Mt5SettingsResponse
}

export async function testMt5Connection(): Promise<Mt5TestConnectionResult> {
  const res = await fetch("/api/mt5/test-connection", {
    method: "POST",
    credentials: "include",
  })
  const body = await res.json().catch(() => ({}))
  return body as Mt5TestConnectionResult
}
