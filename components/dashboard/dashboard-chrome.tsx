"use client"

import type { ReactNode } from "react"
import { DashboardAppShell } from "@/components/dashboard/dashboard-app-shell"
import { DashboardFab } from "@/components/dashboard/dashboard-fab"
import { DashboardMobileDock } from "@/components/dashboard/dashboard-mobile-dock"
import { DashboardUserBar } from "@/components/dashboard/dashboard-user-bar"
import type { DashboardTab } from "@/components/dashboard/trading-components"
import type { UserProfileCardProps } from "@/components/dashboard/user-profile-card"
import type { DockHighlightId } from "@/lib/dashboard-dock"

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
  onDockJournal?: () => void
  onDockCoach?: () => void
  onDockLog?: () => void
  onDockPlanner?: () => void
  onDockWarRoom?: () => void
  onDockAnalytics?: () => void
  aiLauncher?: ReactNode
  banner?: ReactNode
  mainClassName?: string
  showSignalBell?: boolean
  onSignalAlertClick?: (signal: import("@/lib/tradingview/types").TradingViewSignalListItem) => void
  dockHighlight?: DockHighlightId
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
  onDockJournal,
  onDockCoach,
  onDockLog,
  onDockPlanner,
  onDockWarRoom,
  onDockAnalytics,
  aiLauncher,
  banner,
  mainClassName,
  showSignalBell,
  onSignalAlertClick,
  dockHighlight = null,
}: DashboardChromeProps) {
  return (
    <DashboardAppShell
      activeTab={activeTab}
      onOpenSettings={onOpenSettings}
      mainClassName={mainClassName}
      showSignalBell={showSignalBell}
      onSignalAlertClick={onSignalAlertClick}
      hideMobileHeaderNav={showMobileDock}
      onOpenCoach={onDockCoach}
      dockHighlight={dockHighlight}
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
        showMobileDock && onDockHome && onDockJournal && onDockCoach && onDockLog ? (
          <DashboardMobileDock
            activeTab={activeTab}
            dockHighlight={dockHighlight}
            onHome={onDockHome}
            onJournal={onDockJournal}
            onCoach={onDockCoach}
            onLog={onDockLog}
            onPlanner={onDockPlanner}
            onWarRoom={onDockWarRoom}
            onAnalytics={onDockAnalytics}
          />
        ) : null
      }
      banner={banner}
    >
      {children}
    </DashboardAppShell>
  )
}
