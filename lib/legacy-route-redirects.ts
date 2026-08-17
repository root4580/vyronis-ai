/**
 * Retires the old dashboard shell routes (/hq, /analytics, /profile,
 * /strategy) in favor of their new 5-tab redesign equivalents, without
 * touching the old page components themselves — the components stay in
 * the repo untouched (fast rollback: delete this file's callsite in
 * middleware) but are intercepted here before they ever render.
 *
 * Only these four routes are retired. War Room, Trade Planner, Scanner,
 * Council, Strategy Brain, Research Lab, and the old journal-close flow
 * are intentionally left alone — the Plan tab links out to them rather
 * than duplicating them, so they stay live at their existing URLs.
 */
export function resolveLegacyRouteRedirect(
  pathname: string,
  searchParams: URLSearchParams,
): string | null {
  if (pathname === "/hq") {
    const tab = searchParams.get("tab")
    const forwarded = new URLSearchParams()

    const trade = searchParams.get("trade")?.trim()
    if (trade) forwarded.set("trade", trade)

    const action = searchParams.get("action")?.trim()
    if (action) forwarded.set("action", action)

    const target = tab === "journal" ? "/trade" : "/home"
    const query = forwarded.toString()
    return query ? `${target}?${query}` : target
  }

  if (pathname === "/analytics") return "/review"
  if (pathname === "/profile") return "/settings"
  if (pathname === "/strategy") return "/settings"

  return null
}
