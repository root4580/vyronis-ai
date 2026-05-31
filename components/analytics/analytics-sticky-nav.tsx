"use client"

import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { id: "analytics-weekly-review", label: "Weekly review" },
  { id: "analytics-learning", label: "Learning" },
  { id: "analytics-overview", label: "Overview" },
  { id: "analytics-charts", label: "Charts" },
] as const

export function AnalyticsStickyNav() {
  return (
    <nav
      aria-label="Analytics sections"
      className="sticky top-0 z-20 -mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--surface-page)]/95 px-1 py-2 backdrop-blur-md"
    >
      {NAV_ITEMS.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={cn(
            "shrink-0 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[11px] font-medium text-text-muted transition-colors",
            "hover:bg-white/[0.04] hover:text-text-primary",
          )}
        >
          {item.label}
        </a>
      ))}
    </nav>
  )
}
