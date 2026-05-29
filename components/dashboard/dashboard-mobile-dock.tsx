"use client"

import { BarChart3, BookOpen, Brain, ClipboardList, Crosshair, LayoutDashboard } from "lucide-react"
import type { DashboardTab } from "@/components/dashboard/trading-components"
import type { DockHighlightId } from "@/lib/dashboard-dock"
import { cn } from "@/lib/utils"

type DashboardMobileDockProps = {
  activeTab: DashboardTab
  dockHighlight?: DockHighlightId
  onHome: () => void
  onJournal: () => void
  onCoach: () => void
  onLog: () => void
  onWarRoom?: () => void
  onAnalytics?: () => void
  className?: string
}

export function DashboardMobileDock({
  activeTab,
  dockHighlight = null,
  onHome,
  onJournal,
  onCoach,
  onLog,
  onWarRoom,
  onAnalytics,
  className,
}: DashboardMobileDockProps) {
  const items = [
    { id: "dashboard" as const, label: "Home", icon: LayoutDashboard, onClick: onHome },
    { id: "journal" as const, label: "Journal", icon: BookOpen, onClick: onJournal },
    { id: "coach" as const, label: "Chat", icon: Brain, onClick: onCoach, accent: true },
    { id: "log" as const, label: "Log", icon: ClipboardList, onClick: onLog },
    ...(onWarRoom
      ? [{ id: "war-room" as const, label: "War Room", icon: Crosshair, onClick: onWarRoom }]
      : []),
    ...(onAnalytics
      ? [{ id: "analytics" as const, label: "Stats", icon: BarChart3, onClick: onAnalytics }]
      : []),
  ]

  return (
    <nav aria-label="Main navigation" className={cn("dashboard-mobile-dock", className)}>
      {items.map((item) => {
        const isActive = dockHighlight === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "dashboard-mobile-dock-btn",
              item.accent && !isActive && "dashboard-mobile-dock-btn-coach",
              isActive && "dashboard-mobile-dock-btn-active",
            )}
          >
            <item.icon className="size-5" />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
