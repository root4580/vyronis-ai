"use client"

import { ClipboardCheck, Pencil, Zap } from "lucide-react"
import type { TradeJournalMode } from "@/lib/trade-journal-mode"
import { cn } from "@/lib/utils"

type TradeJournalModeTabsProps = {
  mode: TradeJournalMode
  onChange: (mode: TradeJournalMode) => void
  disabled?: boolean
  showPlanHint?: boolean
  onDismissPlanHint?: () => void
}

const MODES: Array<{
  id: TradeJournalMode
  label: string
  short: string
  icon: typeof Zap
}> = [
  { id: "plan", label: "Plan setup", short: "Plan", icon: ClipboardCheck },
  { id: "log", label: "Log result", short: "Log", icon: Zap },
]

export function TradeJournalModeTabs({
  mode,
  onChange,
  disabled,
  showPlanHint = false,
  onDismissPlanHint,
}: TradeJournalModeTabsProps) {
  if (mode === "edit") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
        <Pencil className="size-3.5 text-cyan-glow" />
        <span className="text-[11px] font-medium text-foreground/90">Editing full trade</span>
      </div>
    )
  }

  return (
    <div className="relative">
      {showPlanHint ? (
        <button
          type="button"
          onClick={onDismissPlanHint}
          className="absolute -top-11 left-0 z-10 max-w-[min(100%,240px)] rounded-lg border border-cyan-glow/25 bg-[#0d1118] px-3 py-2 text-left shadow-lg shadow-black/30"
        >
          <p className="text-[11px] font-medium leading-snug text-cyan-glow">
            Score your setup BEFORE you enter — use Plan mode
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground/70">Tap to dismiss</p>
          <span className="absolute -bottom-1.5 left-6 size-3 rotate-45 border-b border-r border-cyan-glow/25 bg-[#0d1118]" />
        </button>
      ) : null}

      <div
        className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-black/20 p-1"
        role="tablist"
        aria-label="Trade journal mode"
      >
      {MODES.map(({ id, label, short, icon: Icon }) => {
        const active = mode === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-[11px] font-semibold transition-all sm:gap-2 sm:px-3 sm:text-[12px]",
              active
                ? "bg-gradient-to-r from-cyan-glow/20 to-cyan-glow/10 text-cyan-glow shadow-[0_0_16px_rgba(34,211,238,0.12)]"
                : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground/85",
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{short}</span>
          </button>
        )
      })}
      </div>
    </div>
  )
}
