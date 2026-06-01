import type { DashboardTab } from "@/components/dashboard/trading-components"
import { APP_HOME_PATH } from "@/lib/branding"

export function getDashboardTabHref(tab: DashboardTab): string {
  if (tab === "analytics") return "/analytics"
  if (tab === "dashboard") return `${APP_HOME_PATH}?tab=dashboard`
  return `${APP_HOME_PATH}?tab=${tab}`
}

/** Opens TradeDetailsModal with cinematic execution replay on HQ. */
export function getTradeReplayHref(tradeId: string): string {
  return `${APP_HOME_PATH}?tab=journal&trade=${encodeURIComponent(tradeId)}`
}

/** Parse `?tab=` for in-app sections. Analytics uses a dedicated route. */
export function parseTabSearchParam(value: string | null): DashboardTab | null {
  if (value === "dashboard" || value === "strategies" || value === "journal") {
    return value
  }
  return null
}

export function readTabFromLocation(): DashboardTab | null {
  if (typeof window === "undefined") return null
  return parseTabSearchParam(new URLSearchParams(window.location.search).get("tab"))
}

/** Authenticated product home — dashboard overview. */
export function getDashboardHomeHref(): string {
  return APP_HOME_PATH
}

/** Full chapter review for a closed or active trading week. */
export function getChapterReviewHref(weekStart: string): string {
  return `/chapters/${encodeURIComponent(weekStart.trim())}`
}

/** Deep-link from War Room into pre-trade Coach with watchlist context. */
export function getWarRoomCoachHref(pairs: string[]): string {
  const normalized = pairs.map((pair) => pair.trim()).filter(Boolean)
  if (normalized.length === 1) {
    return `/war-room?coachPair=${encodeURIComponent(normalized[0])}`
  }
  return `/war-room?openCoach=1`
}

/** Legacy HQ deep link — still supported on dashboard home. */
export function getHqCoachPairHref(pair: string): string {
  return `${APP_HOME_PATH}?coachPair=${encodeURIComponent(pair.trim())}`
}

/** Practice Room — paper trades never touch live P&L. */
export function getPracticeRoomHref(
  params?: Record<string, string | number | null | undefined>,
): string {
  if (!params) return "/practice-room"
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") {
      search.set(key, String(value))
    }
  }
  const query = search.toString()
  return query ? `/practice-room?${query}` : "/practice-room"
}

/** Home path after refresh — strips `tab`, keeps safe deep-link params only. */
export function buildDashboardHomePath(searchParams: URLSearchParams | null): string {
  const preserve = new URLSearchParams()
  if (searchParams?.get("action") === "new-trade") {
    preserve.set("action", "new-trade")
  }
  const trade = searchParams?.get("trade")?.trim()
  if (trade) {
    preserve.set("trade", trade)
  }
  const query = preserve.toString()
  return query ? `${APP_HOME_PATH}?${query}` : APP_HOME_PATH
}
