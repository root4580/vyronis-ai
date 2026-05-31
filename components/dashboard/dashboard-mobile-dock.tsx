"use client"

import { Brain, ClipboardList, LayoutDashboard, Menu, Target } from "lucide-react"
import type { DockHighlightId } from "@/lib/dashboard-dock"
import { cn } from "@/lib/utils"

type DashboardMobileDockProps = {
  dockHighlight?: DockHighlightId
  onHome: () => void
  onPlanner: () => void
  onLog: () => void
  onCoach: () => void
  onMore: () => void
  className?: string
}

export function DashboardMobileDock({
  dockHighlight = null,
  onHome,
  onPlanner,
  onLog,
  onCoach,
  onMore,
  className,
}: DashboardMobileDockProps) {
  const items = [
    { id: "dashboard" as const, label: "Home", icon: LayoutDashboard, onClick: onHome },
    { id: "planner" as const, label: "Plan", icon: Target, onClick: onPlanner },
    { id: "log" as const, label: "Log", icon: ClipboardList, onClick: onLog },
    { id: "coach" as const, label: "Chat", icon: Brain, onClick: onCoach, accent: true },
    { id: "more" as const, label: "More", icon: Menu, onClick: onMore },
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
