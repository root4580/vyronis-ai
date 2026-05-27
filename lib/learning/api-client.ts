import type {
  AiReviewRecord,
  JournalIntelligenceResult,
  LearningMemorySnapshot,
} from "@/lib/learning/types"

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Learning request failed")
  }
  return payload as T
}

export async function fetchLearningDashboard(): Promise<LearningMemorySnapshot> {
  const response = await fetch("/api/learning/dashboard", { credentials: "same-origin" })
  return parseJson(response)
}

export async function syncLearningMemory(): Promise<{ synced: number; skipped?: boolean }> {
  const response = await fetch("/api/learning/memory/sync", {
    method: "POST",
    credentials: "same-origin",
  })
  return parseJson(response)
}

export async function syncTradeLearningMemory(
  tradeId: string,
): Promise<{ synced: boolean; skipped?: boolean; journal?: JournalIntelligenceResult }> {
  const response = await fetch(`/api/learning/trades/${tradeId}/sync`, {
    method: "POST",
    credentials: "same-origin",
  })
  return parseJson(response)
}

export async function fetchJournalIntelligence(tradeId: string): Promise<JournalIntelligenceResult> {
  const response = await fetch(`/api/learning/trades/${tradeId}/journal`, {
    credentials: "same-origin",
  })
  return parseJson(response)
}

export async function generateWeeklyLearningReview(
  weekOffset = 0,
): Promise<{ review: AiReviewRecord; persisted: boolean; skipped?: boolean }> {
  const response = await fetch("/api/learning/reviews/weekly", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ weekOffset }),
  })
  return parseJson(response)
}

export async function fetchLearningReviews(limit = 4): Promise<AiReviewRecord[]> {
  const response = await fetch(`/api/learning/reviews?limit=${limit}`, {
    credentials: "same-origin",
  })
  return parseJson(response)
}
