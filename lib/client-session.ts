import { clearCachedTrades } from "@/lib/dashboard-cache"
import { getDailyRitualStorageKey } from "@/lib/daily-ritual"
import { clearCachedUserProfile } from "@/lib/user-profile"

const JOURNAL_SESSION_KEYS = [
  "vyronis-journal-filters",
  "vyronis-journal-sort-key",
  "vyronis-journal-sort-dir",
] as const

/** Clear all client-side session data on logout or account switch. */
export function clearClientSessionData(userId?: string | null) {
  clearCachedTrades()
  clearCachedUserProfile()

  if (typeof window === "undefined") return

  for (const key of JOURNAL_SESSION_KEYS) {
    sessionStorage.removeItem(key)
  }

  if (userId) {
    localStorage.removeItem(getDailyRitualStorageKey(userId))
  }
}

export type InsightSourceLabel = {
  short: string
  description: string
}

/** Honest labels for review/coach provider badges — avoids "AI" theater. */
export function formatInsightSourceLabel(
  provider: string | null | undefined,
): InsightSourceLabel {
  const id = (provider || "deterministic").toLowerCase()

  if (id === "deterministic" || id === "heuristic") {
    return {
      short: "Journal rules",
      description: "Built from your logged trades and discipline tags — no generative AI.",
    }
  }

  if (id === "openai" || id === "claude" || id === "gemini" || id === "anthropic") {
    return {
      short: "AI-assisted",
      description: "Narrative layer on top of your journal data. Numbers come from your trades.",
    }
  }

  return {
    short: "Journal analysis",
    description: "Derived from your trade history.",
  }
}
