import type { DailyJournalClosePayload, DailyJournalCloseResponse } from "@/lib/daily-journal/types"

export async function fetchDailyJournalClose(input: {
  accountId: string
  sessionDate?: string
}): Promise<DailyJournalCloseResponse> {
  const params = new URLSearchParams({ accountId: input.accountId })
  if (input.sessionDate) params.set("date", input.sessionDate)

  const response = await fetch(`/api/journal/daily-close?${params.toString()}`, {
    credentials: "same-origin",
    cache: "no-store",
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || "Failed to load daily journal")
  }

  return response.json() as Promise<DailyJournalCloseResponse>
}

export async function saveDailyJournalClose(
  payload: DailyJournalClosePayload,
): Promise<DailyJournalCloseResponse> {
  const response = await fetch("/api/journal/daily-close", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || "Failed to save daily journal")
  }

  return response.json() as Promise<DailyJournalCloseResponse>
}
