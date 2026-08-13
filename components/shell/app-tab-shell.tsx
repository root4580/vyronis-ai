"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { APP_TABS, type AppTab } from "@/lib/app-nav"
import { DashboardUserBar } from "@/components/dashboard/dashboard-user-bar"
import type { UserProfileCardProps } from "@/components/dashboard/user-profile-card"
import { cn } from "@/lib/utils"

type AppTabShellProps = {
  activeTab: AppTab
  children: ReactNode
  profileCard: UserProfileCardProps
  showProfileEmptyHint?: boolean
  onOpenSettings: () => void
  onLogout: () => void
  isLoggingOut?: boolean
  accountSwitcher?: ReactNode
  banner?: ReactNode
  fab?: ReactNode
  advisorBar?: ReactNode
}

function DesktopTabNav({ activeTab }: { activeTab: AppTab }) {
  return (
    <nav aria-label="Main navigation" className="hidden border-b border-[var(--border-subtle)] md:block">
      <div className="dashboard-container flex items-center gap-1 px-4 md:px-6">
        {APP_TABS.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium text-text-muted transition-colors hover:text-text-primary",
                isActive && "text-text-primary",
              )}
            >
              <tab.icon className="size-3.5" />
              {tab.label}
              {isActive ? (
                <span
                  className="absolute inset-x-3 -bottom-px h-[2px] rounded-full"
                  style={{ background: "var(--color-accent)" }}
                  aria-hidden="true"
                />
              ) : null}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function MobileTabDock({ activeTab }: { activeTab: AppTab }) {
  return (
    <nav aria-label="Main navigation" className="dashboard-mobile-dock">
      {APP_TABS.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn("dashboard-mobile-dock-btn", isActive && "dashboard-mobile-dock-btn-active")}
          >
            <tab.icon className="size-5" />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * Shared shell for the new 5-tab redesign (Home/Plan/Trade/Review/Settings).
 * Runs alongside the legacy DashboardAppShell — new routes only.
 */
export function AppTabShell({
  activeTab,
  children,
  profileCard,
  showProfileEmptyHint = false,
  onOpenSettings,
  onLogout,
  isLoggingOut = false,
  accountSwitcher,
  banner,
  fab,
  advisorBar,
}: AppTabShellProps) {
  const pathname = usePathname()

  return (
    <div className={cn("dashboard-shell", "dashboard-shell-has-dock")} data-pathname={pathname}>
      <DesktopTabNav activeTab={activeTab} />
      <DashboardUserBar
        profileCard={profileCard}
        showProfileEmptyHint={showProfileEmptyHint}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
        isLoggingOut={isLoggingOut}
        accountSwitcher={accountSwitcher}
      />
      <main className="dashboard-container dashboard-shell-main space-y-6 px-4 py-5 pb-28 md:space-y-8 md:px-6 md:py-6 md:pb-24">
        {banner}
        {children}
      </main>
      {advisorBar}
      {fab}
      <MobileTabDock activeTab={activeTab} />
    </div>
  )
}
