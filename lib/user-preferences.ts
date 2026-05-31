import type { DashboardTab } from "@/components/dashboard/trading-components"

export type AlertPreferences = {
  lossStreak5TradeId?: string | null
  weeklyDebriefWeekKey?: string | null
}

export type DashboardPreferences = {
  activeTab: DashboardTab
  onboardingCompleted?: boolean
  alerts?: AlertPreferences
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
  const alerts = parseAlertPreferences(record.alerts)

  if (VALID_TABS.has(activeTab)) {
    return { activeTab, onboardingCompleted, alerts }
  }

  return { ...DEFAULT_DASHBOARD_PREFERENCES, onboardingCompleted, alerts }
}

function parseAlertPreferences(value: unknown): AlertPreferences | undefined {
  if (!value || typeof value !== "object") return undefined
  const record = value as AlertPreferences
  return {
    lossStreak5TradeId:
      typeof record.lossStreak5TradeId === "string" ? record.lossStreak5TradeId : undefined,
    weeklyDebriefWeekKey:
      typeof record.weeklyDebriefWeekKey === "string" ? record.weeklyDebriefWeekKey : undefined,
  }
}

export function mergeDashboardPreferences(
  current: unknown,
  patch: Partial<DashboardPreferences>,
): DashboardPreferences {
  return { ...parseDashboardPreferences(current), ...patch }
}
