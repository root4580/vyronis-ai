import type { StrategyPlaybookInput, StrategyPlaybookRecord } from "@/lib/strategy/types"

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Strategy playbook request failed")
  }
  return payload as T
}

export async function fetchStrategyPlaybooks(): Promise<StrategyPlaybookRecord[]> {
  const response = await fetch("/api/strategies/playbooks", {
    credentials: "same-origin",
  })
  return parseJson(response)
}

export async function createStrategyPlaybookApi(
  input: Partial<StrategyPlaybookInput>,
): Promise<StrategyPlaybookRecord> {
  const response = await fetch("/api/strategies/playbooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  })
  return parseJson(response)
}

export async function updateStrategyPlaybookApi(
  playbookId: string,
  input: Partial<StrategyPlaybookInput>,
): Promise<StrategyPlaybookRecord> {
  const response = await fetch(`/api/strategies/playbooks/${playbookId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  })
  return parseJson(response)
}

export async function deleteStrategyPlaybookApi(playbookId: string): Promise<void> {
  const response = await fetch(`/api/strategies/playbooks/${playbookId}`, {
    method: "DELETE",
    credentials: "same-origin",
  })
  await parseJson(response)
}

export async function updateCoachSessionContext(
  sessionId: string,
  patch: {
    strategy_playbook_id?: string | null
    strategy_name?: string | null
    pair?: string
    direction?: string
    higher_timeframe?: string
    entry_timeframe?: string
    confirmation_timeframe?: string
  },
): Promise<import("@/lib/trade-coach/types").TradeCoachSessionWithMessages> {
  const response = await fetch(`/api/coach/sessions/${sessionId}/context`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(patch),
  })
  return parseJson(response)
}
