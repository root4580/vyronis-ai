import type { TradeIntelligenceBundle } from "@/lib/intelligence/trade-intelligence-types"

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Intelligence request failed")
  }
  return payload as T
}

export async function fetchTradeIntelligence(tradeId: string): Promise<TradeIntelligenceBundle> {
  const response = await fetch(`/api/intelligence/trades/${tradeId}`, {
    credentials: "same-origin",
  })
  return parseJson(response)
}

export async function analyzeTradeIntelligence(
  tradeId: string,
  options?: { persistSetupScore?: boolean; syncMemory?: boolean },
): Promise<{
  bundle: TradeIntelligenceBundle
  memorySync?: { synced: boolean; skipped?: boolean }
  setupScorePersisted?: boolean
}> {
  const response = await fetch(`/api/intelligence/trades/${tradeId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(options ?? {}),
  })
  return parseJson(response)
}
