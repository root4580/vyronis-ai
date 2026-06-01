import type { CoachChapterContext } from "@/lib/coach-chapters/types"

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Request failed")
  }
  return payload as T
}

export async function fetchCoachChapterContext(input?: {
  accountId?: string | null
  traderFirstName?: string | null
}): Promise<CoachChapterContext> {
  const params = new URLSearchParams()
  if (input?.accountId) params.set("accountId", input.accountId)
  if (input?.traderFirstName) params.set("traderFirstName", input.traderFirstName)
  const query = params.toString()
  const response = await fetch(`/api/coach/chapter-context${query ? `?${query}` : ""}`, {
    cache: "no-store",
  })
  return parseJson<CoachChapterContext>(response)
}
