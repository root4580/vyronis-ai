"use client"

import { BarChart3, BookOpen, Brain, ClipboardList, Crosshair } from "lucide-react"
import { cn } from "@/lib/utils"

type DashboardQuickNavProps = {
  onCalendar: () => void
  onChat: () => void
  onLog: () => void
  onStats?: () => void
  onWarRoom?: () => void
  className?: string
}

export function DashboardQuickNav({
  onCalendar,
  onChat,
  onLog,
  onStats,
  onWarRoom,
  className,
}: DashboardQuickNavProps) {
  const items = [
    { id: "calendar", label: "Calendar", icon: BookOpen, onClick: onCalendar },
    { id: "war-room", label: "War Room", icon: Crosshair, onClick: onWarRoom },
    { id: "chat", label: "Chat", icon: Brain, onClick: onChat },
    { id: "log", label: "Log trade", icon: ClipboardList, onClick: onLog },
    ...(onStats
      ? [{ id: "stats", label: "Performance", icon: BarChart3, onClick: onStats }]
      : []),
  ].filter((item) => item.onClick !== undefined)

  return (
    <nav
      aria-label="Quick navigation"
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5",
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          className={cn(
            "vyronis-surface flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 transition-colors",
            "hover:border-cyan-glow/25 hover:bg-cyan-glow/[0.04]",
            (item.id === "calendar" || item.id === "war-room") && "border-cyan-glow/20",
          )}
        >
          <item.icon
            className={cn(
              "size-5",
              item.id === "calendar" || item.id === "war-room"
                ? "text-cyan-glow"
                : "text-muted-foreground/80",
            )}
          />
          <span className="text-[11px] font-semibold text-foreground/90">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
