"use client"

import { Brain, ClipboardList, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"

type DashboardMobileDockProps = {
  activeHome?: boolean
  onHome: () => void
  onCoach: () => void
  onLog: () => void
  className?: string
}

export function DashboardMobileDock({
  activeHome = true,
  onHome,
  onCoach,
  onLog,
  className,
}: DashboardMobileDockProps) {
  return (
    <nav
      aria-label="Quick actions"
      className={cn("dashboard-mobile-dock", className)}
    >
      <button
        type="button"
        onClick={onHome}
        className={cn(
          "dashboard-mobile-dock-btn",
          activeHome && "dashboard-mobile-dock-btn-active",
        )}
      >
        <LayoutDashboard className="size-5" />
        <span>Home</span>
      </button>
      <button
        type="button"
        onClick={onCoach}
        className="dashboard-mobile-dock-btn dashboard-mobile-dock-btn-coach"
      >
        <Brain className="size-5" />
        <span>Coach</span>
      </button>
      <button
        type="button"
        onClick={onLog}
        className="dashboard-mobile-dock-btn"
      >
        <ClipboardList className="size-5" />
        <span>Log</span>
      </button>
    </nav>
  )
}
