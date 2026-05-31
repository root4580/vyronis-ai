import type { DashboardTab } from "@/components/dashboard/trading-components"
import { APP_HOME_PATH } from "@/lib/branding"

export function getDashboardTabHref(tab: DashboardTab): string {
  if (tab === "analytics") return "/analytics"
  if (tab === "dashboard") return `${APP_HOME_PATH}?tab=dashboard`
  return `${APP_HOME_PATH}?tab=${tab}`
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
