"use client"

import { cn } from "@/lib/utils"

export function JournalHorizontalBarRow({
  label,
  value,
  maxAbs,
  formatValue,
}: {
  label: string
  value: number
  maxAbs: number
  formatValue?: (value: number) => string
}) {
  const pct = maxAbs > 0 ? Math.min(100, (Math.abs(value) / maxAbs) * 100) : 0
  const positive = value >= 0
  const display = formatValue ? formatValue(value) : value >= 0 ? `+$${Math.round(value)}` : `-$${Math.abs(Math.round(value))}`

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-[60px] shrink-0 text-[11px] text-text-muted">{label}</span>
      <div className="h-1 flex-1 overflow-hidden rounded-[2px] bg-white/[0.06]">
        <div
          className={cn("h-full rounded-[2px]", positive ? "bg-[var(--color-profit)]" : "bg-[var(--color-loss)]")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          "min-w-[48px] shrink-0 text-right text-[11px] font-medium tabular-nums",
          positive ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]",
        )}
      >
        {display}
      </span>
    </div>
  )
}
