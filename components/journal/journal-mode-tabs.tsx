"use client"

import { BarChart3, Brain, CalendarDays } from "lucide-react"
import type { JournalViewMode } from "@/lib/journal/journal-workflow"
import { cn } from "@/lib/utils"

const MODES: Array<{
  id: JournalViewMode
  label: string
  icon: typeof CalendarDays
}> = [
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "intelligence", label: "Intelligence", icon: Brain },
]

export function JournalModeTabs({
  mode,
  onChange,
}: {
  mode: JournalViewMode
  onChange: (mode: JournalViewMode) => void
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-black/30 p-1">
      {MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-medium transition-colors sm:flex-none sm:px-3",
            mode === id
              ? "bg-cyan-glow/15 text-cyan-glow"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5 shrink-0" />
          {label}
        </button>
      ))}
    </div>
  )
}
