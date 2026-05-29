"use client"

import type { ReactNode } from "react"
import { DashboardAppShell } from "@/components/dashboard/dashboard-app-shell"
import { DashboardFab } from "@/components/dashboard/dashboard-fab"
import { DashboardMobileDock } from "@/components/dashboard/dashboard-mobile-dock"
import { DashboardUserBar } from "@/components/dashboard/dashboard-user-bar"
import type { DashboardTab } from "@/components/dashboard/trading-components"
import type { UserProfileCardProps } from "@/components/dashboard/user-profile-card"

type DashboardChromeProps = {
  activeTab: DashboardTab
  children: ReactNode
  profileCard: UserProfileCardProps
  showProfileEmptyHint?: boolean
  onOpenSettings: () => void
  onLogout: () => void
  isLoggingOut?: boolean
  showFab?: boolean
  onFabClick?: () => void
  showMobileDock?: boolean
  onDockHome?: () => void
  onDockCoach?: () => void
  onDockLog?: () => void
  aiLauncher?: ReactNode
  banner?: ReactNode
  mainClassName?: string
  showSignalBell?: boolean
  onSignalAlertClick?: (signal: import("@/lib/tradingview/types").TradingViewSignalListItem) => void
}

export function DashboardChrome({
  activeTab,
  children,
  profileCard,
  showProfileEmptyHint = false,
  onOpenSettings,
  onLogout,
  isLoggingOut = false,
  showFab = false,
  onFabClick,
  showMobileDock = false,
  onDockHome,
  onDockCoach,
  onDockLog,
  aiLauncher,
  banner,
  mainClassName,
  showSignalBell,
  onSignalAlertClick,
}: DashboardChromeProps) {
  return (
    <DashboardAppShell
      activeTab={activeTab}
      onOpenSettings={onOpenSettings}
      mainClassName={mainClassName}
      showSignalBell={showSignalBell}
      onSignalAlertClick={onSignalAlertClick}
      userBar={
        <DashboardUserBar
          profileCard={profileCard}
          showProfileEmptyHint={showProfileEmptyHint}
          onOpenSettings={onOpenSettings}
          onLogout={onLogout}
          isLoggingOut={isLoggingOut}
        />
      }
      aiLauncher={aiLauncher}
      fab={showFab && onFabClick ? <DashboardFab onClick={onFabClick} /> : null}
      mobileDock={
        showMobileDock && onDockHome && onDockCoach && onDockLog ? (
          <DashboardMobileDock
            activeHome={activeTab === "dashboard"}
            onHome={onDockHome}
            onCoach={onDockCoach}
            onLog={onDockLog}
          />
        ) : null
      }
      banner={banner}
    >
      {children}
    </DashboardAppShell>
  )
}
