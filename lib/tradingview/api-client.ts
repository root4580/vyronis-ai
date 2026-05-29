import type { TradingViewSignalListItem } from "@/lib/tradingview/types"
import { notifyTradingViewSignalsRefresh } from "@/lib/tradingview/signals-events"

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "TradingView signals request failed")
  }
  return payload as T
}

export async function fetchTradingViewSignals(options?: {
  unreadOnly?: boolean
  limit?: number
}): Promise<{ signals: TradingViewSignalListItem[]; unreadCount: number }> {
  const params = new URLSearchParams()
  if (options?.unreadOnly) params.set("unreadOnly", "true")
  if (options?.limit) params.set("limit", String(options.limit))

  const response = await fetch(`/api/tradingview/signals?${params.toString()}`, {
    credentials: "same-origin",
  })

  return parseJson(response)
}

export async function markTradingViewSignalRead(signalId: string): Promise<void> {
  const response = await fetch(`/api/tradingview/signals/${signalId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ read: true }),
  })

  await parseJson(response)
}

export async function markAllTradingViewSignalsRead(): Promise<void> {
  const response = await fetch("/api/tradingview/signals", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ readAll: true }),
  })

  await parseJson(response)
}

export async function fetchTradingViewWebhookSettings(): Promise<{
  secret: string
  enabled: boolean
  webhookUrl: string
  alertTemplate: string
}> {
  const response = await fetch("/api/tradingview/settings", { credentials: "same-origin" })
  return parseJson(response)
}

export type TradingViewSetupReadiness = {
  ready: boolean
  steps: Array<{
    id: string
    label: string
    done: boolean
    hint: string
    action?: string
  }>
  suggestedTestSymbol: string | null
  suggestedTestDirection: "BUY" | "SELL"
}

export async function fetchTradingViewSetupReadiness(): Promise<TradingViewSetupReadiness> {
  const response = await fetch("/api/tradingview/readiness", { credentials: "same-origin" })
  return parseJson(response)
}

export async function sendTradingViewTestAlert(input?: {
  symbol?: string
  direction?: "BUY" | "SELL"
}): Promise<{
  ok: boolean
  setup_grade?: string
  setup_verdict?: string
  email_sent?: boolean
  message?: string
  symbol?: string
  direction?: string
  coachSessionId?: string
}> {
  const response = await fetch("/api/tradingview/test-alert", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input ?? {}),
  })
  const result = await parseJson<{
    ok: boolean
    setup_grade?: string
    setup_verdict?: string
    email_sent?: boolean
    message?: string
    symbol?: string
    direction?: string
    coachSessionId?: string
  }>(response)
  notifyTradingViewSignalsRefresh()
  return result
}

export async function regenerateTradingViewWebhookSecret(): Promise<{
  secret: string
  enabled: boolean
  webhookUrl: string
  alertTemplate: string
}> {
  const response = await fetch("/api/tradingview/settings", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ regenerateSecret: true }),
  })
  return parseJson(response)
}
