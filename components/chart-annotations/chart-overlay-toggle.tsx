"use client"

import type { ChartOverlayMode } from "@/lib/chart-annotations/types"
import { cn } from "@/lib/utils"

type ChartOverlayToggleProps = {
  mode: ChartOverlayMode
  onChange: (mode: ChartOverlayMode) => void
  className?: string
  compact?: boolean
}

const MODES: Array<{ id: ChartOverlayMode; label: string }> = [
  { id: "raw", label: "Raw Chart" },
  { id: "overlay", label: "AI Overlay" },
  { id: "replay", label: "Replay Mode" },
]

export function ChartOverlayToggle({
  mode,
  onChange,
  className,
  compact = false,
}: ChartOverlayToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-white/[0.08] bg-black/30 p-0.5",
        className,
      )}
    >
      {MODES.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "rounded-md px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors",
            compact && "px-1.5 py-0.5 text-[8px]",
            mode === item.id
              ? "bg-cyan-glow/[0.14] text-cyan-glow"
              : "text-muted-foreground/70 hover:text-foreground/85",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
