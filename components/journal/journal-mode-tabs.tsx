"use client"

import { BarChart3, Brain, CalendarDays, List } from "lucide-react"
import type { JournalViewMode } from "@/lib/journal/journal-workflow"
import { cn } from "@/lib/utils"

const MODES: Array<{
  id: JournalViewMode
  label: string
  icon: typeof CalendarDays
}> = [
  { id: "trades", label: "Trades", icon: List },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "analytics", label: "Stats", icon: BarChart3 },
  { id: "intelligence", label: "Memory", icon: Brain },
]

export function JournalModeTabs({
  mode,
  onChange,
}: {
  mode: JournalViewMode
  onChange: (mode: JournalViewMode) => void
}) {
  return (
    <div
      className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-[3px]"
      role="tablist"
      aria-label="Journal view"
    >
      <div className="grid grid-cols-4 gap-[3px]">
        {MODES.map(({ id, label, icon: Icon }) => {
          const active = mode === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-2 text-[12px] transition-colors",
                active
                  ? "bg-[var(--surface-page)] font-medium text-text-primary"
                  : "bg-transparent text-text-muted hover:text-text-secondary",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
