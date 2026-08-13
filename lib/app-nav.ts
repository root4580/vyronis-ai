import type { LucideIcon } from "lucide-react"
import { BarChart3, ClipboardList, LayoutDashboard, Settings as SettingsIcon, Target } from "lucide-react"

/**
 * The new simplified 5-tab IA (Home / Plan / Trade / Review / Settings).
 * Lives alongside the legacy nav (lib/dashboard-nav.ts) while the redesign
 * is rolled out at new routes. Once every tab is verified, the legacy
 * routes get retired and this becomes the only nav.
 */
export type AppTab = "home" | "plan" | "trade" | "review" | "settings"

export type AppTabDefinition = {
  id: AppTab
  label: string
  href: string
  icon: LucideIcon
}

export const APP_TABS: AppTabDefinition[] = [
  { id: "home", label: "Home", href: "/home", icon: LayoutDashboard },
  { id: "plan", label: "Plan", href: "/plan", icon: Target },
  { id: "trade", label: "Trade", href: "/trade", icon: ClipboardList },
  { id: "review", label: "Review", href: "/review", icon: BarChart3 },
  { id: "settings", label: "Settings", href: "/settings", icon: SettingsIcon },
]

export function getAppTabHref(tab: AppTab): string {
  return APP_TABS.find((t) => t.id === tab)?.href ?? "/home"
}

/** New product home under the redesign (replaces APP_HOME_PATH long-term). */
export const NEW_APP_HOME_PATH = "/home"
