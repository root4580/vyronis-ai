import type { ExecutionReplayResult } from "@/lib/replay/types"
import { normalizeExecutionReplay } from "@/lib/replay/normalize-replay-result"

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Execution replay request failed")
  }
  return payload as T
}

export async function fetchExecutionReplay(tradeId: string): Promise<ExecutionReplayResult> {
  const response = await fetch(`/api/replay/trades/${encodeURIComponent(tradeId)}`, {
    credentials: "same-origin",
  })
  const payload = await parseJson<ExecutionReplayResult>(response)
  return normalizeExecutionReplay(payload)
}
