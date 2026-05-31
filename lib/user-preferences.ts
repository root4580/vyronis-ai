import type { DashboardTab } from "@/components/dashboard/trading-components"

export type DashboardPreferences = {
  activeTab: DashboardTab
  onboardingCompleted?: boolean
}

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  activeTab: "dashboard",
}

const VALID_TABS = new Set<DashboardTab>(["dashboard", "strategies", "analytics", "journal"])

export function parseDashboardPreferences(value: unknown): DashboardPreferences {
  if (!value || typeof value !== "object") {
    return DEFAULT_DASHBOARD_PREFERENCES
  }

  const record = value as DashboardPreferences
  const activeTab = record.activeTab
  const onboardingCompleted =
    typeof record.onboardingCompleted === "boolean" ? record.onboardingCompleted : undefined

  if (VALID_TABS.has(activeTab)) {
    return { activeTab, onboardingCompleted }
  }

  return { ...DEFAULT_DASHBOARD_PREFERENCES, onboardingCompleted }
}

export function mergeDashboardPreferences(
  current: unknown,
  patch: Partial<DashboardPreferences>,
): DashboardPreferences {
  return { ...parseDashboardPreferences(current), ...patch }
}
