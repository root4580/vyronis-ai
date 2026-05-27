import type { WeeklyReviewRecord, WeeklyReviewReport } from "@/lib/weekly-review/types"

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Weekly review request failed")
  }
  return payload as T
}

export async function generateWeeklyReview(
  weekOffset = 0,
  useAiNarrative = false,
): Promise<{
  report: WeeklyReviewReport
  record: WeeklyReviewRecord | null
  persisted: boolean
  skipped?: boolean
}> {
  const response = await fetch("/api/weekly-reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ weekOffset, useAiNarrative }),
  })
  return parseJson(response)
}

export async function fetchWeeklyReviews(limit = 6): Promise<WeeklyReviewRecord[]> {
  const response = await fetch(`/api/weekly-reviews?limit=${limit}`, {
    credentials: "same-origin",
  })
  return parseJson(response)
}

export async function previewWeeklyReview(weekOffset = 0): Promise<WeeklyReviewReport> {
  const response = await fetch(
    `/api/weekly-reviews?preview=true&weekOffset=${encodeURIComponent(String(weekOffset))}`,
    { credentials: "same-origin" },
  )
  return parseJson(response)
}
