"use client"

import { useState, type ReactNode } from "react"
import { DashboardAppShell } from "@/components/dashboard/dashboard-app-shell"
import { DashboardFab } from "@/components/dashboard/dashboard-fab"
import { DashboardMobileDock } from "@/components/dashboard/dashboard-mobile-dock"
import { DashboardMobileMoreSheet } from "@/components/dashboard/dashboard-mobile-more-sheet"
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
  fabDisabled?: boolean
  fabDisabledReason?: string
  showMobileDock?: boolean
  onDockHome?: () => void
  onDockCoach?: () => void
  onDockLog?: () => void
  onDockPlanner?: () => void
  aiLauncher?: ReactNode
  banner?: ReactNode
  mainClassName?: string
  showSignalBell?: boolean
  onSignalAlertClick?: (signal: import("@/lib/tradingview/types").TradingViewSignalListItem) => void
  dockHighlight?: DockHighlightId
  accountSwitcher?: ReactNode
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
  fabDisabled = false,
  fabDisabledReason,
  showMobileDock = false,
  onDockHome,
  onDockCoach,
  onDockLog,
  onDockPlanner,
  aiLauncher,
  banner,
  mainClassName,
  showSignalBell,
  onSignalAlertClick,
  dockHighlight = null,
  accountSwitcher,
}: DashboardChromeProps) {
  const [moreOpen, setMoreOpen] = useState(false)

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
          accountSwitcher={accountSwitcher}
        />
      }
      aiLauncher={aiLauncher}
      fab={
        showFab && onFabClick ? (
          <DashboardFab
            onClick={onFabClick}
            disabled={fabDisabled}
            disabledReason={fabDisabledReason}
          />
        ) : null
      }
      mobileDock={
        showMobileDock && onDockHome && onDockCoach && onDockLog && onDockPlanner ? (
          <>
            <DashboardMobileDock
              dockHighlight={moreOpen ? "more" : dockHighlight}
              onHome={onDockHome}
              onPlanner={onDockPlanner}
              onLog={onDockLog}
              onCoach={onDockCoach}
              onMore={() => setMoreOpen(true)}
            />
            <DashboardMobileMoreSheet
              open={moreOpen}
              onClose={() => setMoreOpen(false)}
              onOpenSettings={onOpenSettings}
            />
          </>
        ) : null
      }
      banner={banner}
    >
      {children}
    </DashboardAppShell>
  )
}
