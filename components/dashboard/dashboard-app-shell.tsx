"use client"

import type { ReactNode } from "react"
import { DashboardHeader, type DashboardTab } from "@/components/dashboard/trading-components"
import { cn } from "@/lib/utils"

type DashboardAppShellProps = {
  activeTab: DashboardTab
  onOpenSettings?: () => void
  children: ReactNode
  mainClassName?: string
  userBar?: ReactNode
  fab?: ReactNode
  mobileDock?: ReactNode
  aiLauncher?: ReactNode
  banner?: ReactNode
  showSignalBell?: boolean
  onSignalAlertClick?: (signal: import("@/lib/tradingview/types").TradingViewSignalListItem) => void
  hideMobileHeaderNav?: boolean
}

export function DashboardAppShell({
  activeTab,
  onOpenSettings,
  children,
  mainClassName = "dashboard-container space-y-6 px-4 py-5 pb-28 md:space-y-8 md:px-6 md:py-6 md:pb-24",
  userBar,
  fab,
  mobileDock,
  aiLauncher,
  banner,
  showSignalBell,
  onSignalAlertClick,
  hideMobileHeaderNav = false,
}: DashboardAppShellProps) {
  return (
    <div className={cn("dashboard-shell", mobileDock && "dashboard-shell-has-dock")}>
      <DashboardHeader
        activeTab={activeTab}
        onOpenSettings={onOpenSettings}
        showSignalBell={showSignalBell}
        onSignalAlertClick={onSignalAlertClick}
        hideMobileNav={hideMobileHeaderNav}
      />
      {userBar}
      <main className={cn("dashboard-shell-main", mainClassName)}>
        {banner}
        {children}
      </main>
      {aiLauncher}
      {fab}
      {mobileDock}
    </div>
  )
}
