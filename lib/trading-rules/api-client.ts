import type { CooldownUnlockResult, TradingRulesSnapshot } from "@/lib/trading-rules/types"

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Request failed")
  }
  return payload as T
}

export async function fetchTradingRulesSnapshot(
  accountId?: string | null,
): Promise<TradingRulesSnapshot | null> {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""
  const response = await fetch(`/api/trading-rules${query}`, { cache: "no-store" })
  const payload = await parseJson<{ snapshot: TradingRulesSnapshot | null }>(response)
  return payload.snapshot ?? null
}

export async function syncTradingRulesCooldown(
  accountId: string,
): Promise<TradingRulesSnapshot | null> {
  const response = await fetch("/api/trading-rules/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  })
  const payload = await parseJson<{ snapshot: TradingRulesSnapshot | null }>(response)
  return payload.snapshot ?? null
}

export async function submitCooldownUnlockRequest(input: {
  accountId: string
  lossCause: string
  changePlan: string
  emotionalScore: number
}): Promise<CooldownUnlockResult> {
  const response = await fetch("/api/trading-rules/cooldown-unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return parseJson<CooldownUnlockResult>(response)
}
