import type { WeeklyDebriefResult } from "@/lib/ai/weekly-debrief-types"

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Weekly debrief request failed")
  }
  return payload as T
}

export async function fetchWeeklyDebrief(weekOffset = 0): Promise<WeeklyDebriefResult> {
  const response = await fetch(
    `/api/ai/weekly-debrief?weekOffset=${encodeURIComponent(String(weekOffset))}`,
    { credentials: "same-origin" },
  )
  return parseJson(response)
}
