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
      className="vyronis-segmented flex gap-0.5 rounded-xl border border-white/[0.08] bg-black/40 p-1"
      role="tablist"
      aria-label="Journal view"
    >
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
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-[11px] font-semibold transition-all sm:flex-none sm:px-4",
              active
                ? "bg-cyan-glow/15 text-cyan-glow shadow-[0_0_20px_rgb(from var(--color-accent) r g b / 0.12)]"
                : "text-muted-foreground/70 hover:text-foreground/90",
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
