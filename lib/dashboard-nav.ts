import type { DashboardTab } from "@/components/dashboard/trading-components"

export function getDashboardTabHref(tab: DashboardTab): string {
  if (tab === "analytics") return "/analytics"
  if (tab === "dashboard") return "/?tab=dashboard"
  return `/?tab=${tab}`
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

/** Home route — always lands on the main Dashboard overview. */
export function getDashboardHomeHref(): string {
  return "/"
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
  return query ? `/?${query}` : "/"
}
