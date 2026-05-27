import type { DashboardTab } from "@/components/dashboard/trading-components"

export type DashboardPreferences = {
  activeTab: DashboardTab
}

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  activeTab: "dashboard",
}

const VALID_TABS = new Set<DashboardTab>(["dashboard", "strategies", "analytics", "journal"])

export function parseDashboardPreferences(value: unknown): DashboardPreferences {
  if (!value || typeof value !== "object") {
    return DEFAULT_DASHBOARD_PREFERENCES
  }

  const activeTab = (value as DashboardPreferences).activeTab
  if (VALID_TABS.has(activeTab)) {
    return { activeTab }
  }

  return DEFAULT_DASHBOARD_PREFERENCES
}
