"use client"

import Link from "next/link"
import {
  BarChart2,
  BookOpen,
  CandlestickChart,
  ChevronRight,
  Crosshair,
  Moon,
  Newspaper,
  NotebookPen,
  Radar,
  Settings,
  Sparkles,
  X,
} from "lucide-react"
import {
  getCouncilHref,
  getDashboardTabHref,
  getJournalCloseHref,
  getNewsHref,
  getPracticeRoomHref,
  getScannerHref,
} from "@/lib/dashboard-nav"
import { cn } from "@/lib/utils"

type DashboardMobileMoreSheetProps = {
  open: boolean
  onClose: () => void
  onOpenSettings?: () => void
  className?: string
}

const MORE_LINKS = [
  { href: getJournalCloseHref(), label: "Close the day", icon: Moon },
  { href: getNewsHref(), label: "News", icon: Newspaper },
  { href: getScannerHref(), label: "A+ Scanner", icon: Radar },
  { href: getCouncilHref(), label: "AI Council", icon: Sparkles },
  { href: "/war-room", label: "War Room", icon: Crosshair },
  { href: getPracticeRoomHref(), label: "Practice Room", icon: NotebookPen },
  { href: getDashboardTabHref("journal"), label: "Journal", icon: BookOpen },
  { href: getDashboardTabHref("analytics"), label: "Analytics", icon: BarChart2 },
  { href: getDashboardTabHref("strategies"), label: "Strategies", icon: CandlestickChart },
] as const

export function DashboardMobileMoreSheet({
  open,
  onClose,
  onOpenSettings,
  className,
}: DashboardMobileMoreSheetProps) {
  if (!open) return null

  return (
    <div className={cn("fixed inset-0 z-50 lg:hidden", className)}>
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-[var(--radius-xl)] border-t border-[var(--border-subtle)] bg-surface-modal pb-[env(safe-area-inset-bottom,0px)]"
        role="dialog"
        aria-modal="true"
        aria-label="More navigation"
      >
        <div className="flex justify-center pt-2">
          <span className="h-1 w-8 rounded-sm bg-white/10" aria-hidden />
        </div>
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <p className="text-sm font-medium text-text-primary">More</p>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="size-4" />
          </button>
        </div>
        <nav className="px-4 pb-4">
          {MORE_LINKS.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 py-3.5 text-sm text-text-primary",
                index < MORE_LINKS.length - 1 && "border-b border-[var(--border-subtle)]",
              )}
            >
              <item.icon className="size-5 text-text-secondary" />
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="size-4 text-text-muted" />
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenSettings?.()
            }}
            className="flex w-full items-center gap-3 border-t border-[var(--border-subtle)] py-3.5 text-left text-sm text-text-primary"
          >
            <Settings className="size-5 text-text-secondary" />
            <span className="flex-1">Settings</span>
            <ChevronRight className="size-4 text-text-muted" />
          </button>
        </nav>
      </div>
    </div>
  )
}
