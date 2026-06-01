import type { ChapterReviewPayload, WeeklyChapterDashboard } from "@/lib/weekly-chapters/types"

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Request failed")
  }
  return payload as T
}

export async function fetchWeeklyChapterDashboard(input?: {
  accountId?: string | null
  disciplineScore?: number | null
  disciplineGrade?: string | null
  traderFirstName?: string | null
}): Promise<WeeklyChapterDashboard> {
  const params = new URLSearchParams()
  if (input?.accountId) params.set("accountId", input.accountId)
  if (input?.disciplineScore != null) params.set("disciplineScore", String(input.disciplineScore))
  if (input?.disciplineGrade) params.set("disciplineGrade", input.disciplineGrade)
  if (input?.traderFirstName) params.set("traderFirstName", input.traderFirstName)
  const query = params.toString()
  const response = await fetch(`/api/weekly-chapters${query ? `?${query}` : ""}`, {
    cache: "no-store",
  })
  return parseJson<WeeklyChapterDashboard>(response)
}

export async function closeCurrentWeekChapter(accountId?: string | null): Promise<void> {
  const response = await fetch("/api/weekly-chapters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  })
  await parseJson(response)
}

export async function fetchChapterReview(
  weekStart: string,
  accountId?: string | null,
): Promise<ChapterReviewPayload> {
  const params = new URLSearchParams()
  if (accountId) params.set("accountId", accountId)
  const query = params.toString()
  const response = await fetch(
    `/api/weekly-chapters/${encodeURIComponent(weekStart)}${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  )
  return parseJson<ChapterReviewPayload>(response)
}
