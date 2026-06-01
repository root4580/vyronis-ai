import type {
  PlannedCoachSessionItem,
  PreTradePlannedContext,
  TradeCoachFeedbackRecord,
  TradeCoachSessionWithMessages,
} from "@/lib/trade-coach/types"

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || "Coach request failed")
  }
  return payload as T
}

export async function createCoachSession(
  plannedContext: PreTradePlannedContext,
  maxRiskPerTrade?: number,
): Promise<TradeCoachSessionWithMessages> {
  const response = await fetch("/api/coach/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ plannedContext, maxRiskPerTrade }),
  })
  return parseJson(response)
}

export async function fetchCoachSession(
  sessionId: string,
): Promise<TradeCoachSessionWithMessages> {
  const response = await fetch(`/api/coach/sessions/${sessionId}`, {
    credentials: "same-origin",
  })
  return parseJson(response)
}

export async function submitCoachAnswer(
  sessionId: string,
  questionKey: string,
  answer: string,
): Promise<TradeCoachSessionWithMessages> {
  const response = await fetch(`/api/coach/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ questionKey, answer }),
  })
  return parseJson(response)
}

export async function submitCoachChart(
  sessionId: string,
  chartUrl: string,
  replace = false,
): Promise<TradeCoachSessionWithMessages> {
  const response = await fetch(`/api/coach/sessions/${sessionId}/chart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ chartUrl, replace }),
  })
  return parseJson(response)
}

export async function runCoachMtfAnalysis(
  sessionId: string,
): Promise<TradeCoachSessionWithMessages> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 130_000)

  try {
    const response = await fetch(`/api/coach/sessions/${sessionId}/mtf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "analyze" }),
      signal: controller.signal,
    })
    return parseJson(response)
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "Analysis timed out after 2 minutes. Try again, or run with fewer charts if the connection is slow.",
      )
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export async function syncCoachWarRoomCharts(
  sessionId: string,
): Promise<TradeCoachSessionWithMessages> {
  const response = await fetch(`/api/coach/sessions/${sessionId}/mtf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action: "syncWarRoom" }),
  })
  return parseJson(response)
}

export async function linkCoachSessionToTrade(
  sessionId: string,
  tradeId: string,
): Promise<void> {
  const response = await fetch(`/api/coach/sessions/${sessionId}/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ tradeId }),
  })
  await parseJson(response)
}

export async function generateCoachFeedback(
  tradeId: string,
): Promise<TradeCoachFeedbackRecord> {
  const response = await fetch("/api/coach/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ tradeId }),
  })
  return parseJson(response)
}

export async function fetchCoachFeedback(
  tradeId: string,
): Promise<TradeCoachFeedbackRecord | null> {
  const response = await fetch(`/api/coach/feedback?tradeId=${encodeURIComponent(tradeId)}`, {
    credentials: "same-origin",
  })
  if (response.status === 404) return null
  return parseJson(response)
}

export async function fetchPendingCoachSession(): Promise<TradeCoachSessionWithMessages | null> {
  const response = await fetch("/api/coach/sessions/pending", {
    credentials: "same-origin",
  })
  if (response.status === 404) return null
  return parseJson(response)
}

export async function fetchPlannedCoachSessions(
  accountId?: string | null,
): Promise<PlannedCoachSessionItem[]> {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""
  const response = await fetch(`/api/coach/sessions/planned${query}`, {
    credentials: "same-origin",
  })
  return parseJson(response)
}

export async function deleteCoachSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/coach/sessions/${sessionId}`, {
    method: "DELETE",
    credentials: "same-origin",
  })
  await parseJson(response)
}

export async function fetchPatternMemory(): Promise<
  import("@/lib/trade-coach/pattern-memory").PatternMemoryResult
> {
  const response = await fetch("/api/coach/pattern-memory", {
    credentials: "same-origin",
  })
  return parseJson(response)
}

export async function fetchTradeQualityAnalytics(): Promise<
  import("@/lib/trade-coach/trade-quality-analytics").TradeQualityAnalytics
> {
  const response = await fetch("/api/coach/quality-analytics", {
    credentials: "same-origin",
  })
  return parseJson(response)
}

export async function recordQualityOverride(sessionId: string): Promise<
  import("@/lib/trade-coach/types").TradeCoachSessionRecord
> {
  const response = await fetch(`/api/coach/sessions/${sessionId}/override`, {
    method: "POST",
    credentials: "same-origin",
  })
  return parseJson(response)
}

export async function fetchLinkedCoachSession(tradeId: string): Promise<
  import("@/lib/trade-coach/types").TradeCoachSessionRecord
> {
  const response = await fetch(
    `/api/coach/sessions/linked?tradeId=${encodeURIComponent(tradeId)}`,
    { credentials: "same-origin" },
  )
  return parseJson(response)
}

export async function fetchCoachSessionHistory(): Promise<
  import("@/lib/trade-coach/types").CoachSessionHistoryItem[]
> {
  const response = await fetch("/api/coach/sessions/history", {
    credentials: "same-origin",
  })
  return parseJson(response)
}
