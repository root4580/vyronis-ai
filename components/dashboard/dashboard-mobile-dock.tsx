"use client"

import { BarChart3, BookOpen, Brain, ClipboardList, LayoutDashboard, Target } from "lucide-react"
import type { DashboardTab } from "@/components/dashboard/trading-components"
import { cn } from "@/lib/utils"

type DashboardMobileDockProps = {
  activeTab: DashboardTab
  onHome: () => void
  onJournal: () => void
  onCoach: () => void
  onLog: () => void
  onStrategies?: () => void
  onAnalytics?: () => void
  className?: string
}

export function DashboardMobileDock({
  activeTab,
  onHome,
  onJournal,
  onCoach,
  onLog,
  onStrategies,
  onAnalytics,
  className,
}: DashboardMobileDockProps) {
  const items = [
    { id: "dashboard" as const, label: "Home", icon: LayoutDashboard, onClick: onHome },
    { id: "journal" as const, label: "Journal", icon: BookOpen, onClick: onJournal },
    { id: "coach" as const, label: "Coach", icon: Brain, onClick: onCoach, accent: true },
    { id: "log" as const, label: "Log", icon: ClipboardList, onClick: onLog },
    ...(onStrategies
      ? [{ id: "strategies" as const, label: "Prep", icon: Target, onClick: onStrategies }]
      : []),
    ...(onAnalytics
      ? [{ id: "analytics" as const, label: "Stats", icon: BarChart3, onClick: onAnalytics }]
      : []),
  ]

  return (
    <nav aria-label="Main navigation" className={cn("dashboard-mobile-dock", className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          className={cn(
            "dashboard-mobile-dock-btn",
            item.accent && "dashboard-mobile-dock-btn-coach",
            item.id !== "coach" && activeTab === item.id && "dashboard-mobile-dock-btn-active",
          )}
        >
          <item.icon className="size-5" />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
