"use client"

import { useMemo, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome"
import type { DashboardTab } from "@/components/dashboard/trading-components"
import type { UserProfileCardProps } from "@/components/dashboard/user-profile-card"
import { resolveDockHighlight } from "@/lib/dashboard-dock"
import { useAIContext } from "@/providers/ai-context-provider"

type ConnectedDashboardChromeProps = {
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
  tradeModalOpen?: boolean
}

export function ConnectedDashboardChrome({
  tradeModalOpen = false,
  ...props
}: ConnectedDashboardChromeProps) {
  const pathname = usePathname()
  const { isOpen, mode } = useAIContext()

  const dockHighlight = useMemo(
    () =>
      resolveDockHighlight({
        activeTab: props.activeTab,
        commandCenterOpen: isOpen,
        commandCenterMode: mode,
        tradeModalOpen,
        pathname: pathname ?? "/",
      }),
    [props.activeTab, isOpen, mode, tradeModalOpen, pathname],
  )

  return <DashboardChrome {...props} dockHighlight={dockHighlight} />
}
