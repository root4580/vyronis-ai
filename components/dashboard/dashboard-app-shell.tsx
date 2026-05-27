"use client"

import type { ReactNode } from "react"
import { DashboardHeader, type DashboardTab } from "@/components/dashboard/trading-components"

type DashboardAppShellProps = {
  activeTab: DashboardTab
  onOpenSettings?: () => void
  children: ReactNode
  mainClassName?: string
}

export function DashboardAppShell({
  activeTab,
  onOpenSettings,
  children,
  mainClassName = "dashboard-container space-y-6 px-4 py-5 pb-28 md:space-y-8 md:px-6 md:py-6 md:pb-24",
}: DashboardAppShellProps) {
  return (
    <div className="dashboard-shell">
      <DashboardHeader activeTab={activeTab} onOpenSettings={onOpenSettings} />
      <main className={mainClassName}>{children}</main>
    </div>
  )
}
