"use client"

import { Pencil } from "lucide-react"
import type { TradeJournalMode } from "@/lib/trade-journal-mode"
import { journalModeLabel } from "@/lib/trade-journal-mode"
import { cn } from "@/lib/utils"

type TradeJournalModeTabsProps = {
  mode: TradeJournalMode
  onChange: (mode: TradeJournalMode) => void
  disabled?: boolean
  showPlanHint?: boolean
  onDismissPlanHint?: () => void
}

const MODES: TradeJournalMode[] = ["plan", "log"]

export function TradeJournalModeTabs({
  mode,
  onChange,
  disabled,
  showPlanHint = false,
  onDismissPlanHint,
}: TradeJournalModeTabsProps) {
  if (mode === "edit") {
    return (
      <div className="flex h-11 items-center gap-2 border-b border-[var(--border-subtle)] bg-white/[0.03] px-4">
        <Pencil className="size-3.5 text-text-accent" />
        <span className="text-[13px] font-medium text-text-primary">Editing full trade</span>
      </div>
    )
  }

  return (
    <div className="relative">
      {showPlanHint ? (
        <button
          type="button"
          onClick={onDismissPlanHint}
          className="absolute -top-11 left-4 z-10 max-w-[min(100%,240px)] rounded-[var(--radius-md)] border border-[var(--color-accent-border)] bg-[var(--surface-modal)] px-3 py-2 text-left shadow-lg shadow-black/30"
        >
          <p className="text-[11px] font-medium leading-snug text-text-accent">
            Score your setup before you enter — use Plan setup
          </p>
          <p className="mt-0.5 text-[10px] text-text-muted">Tap to dismiss</p>
          <span className="absolute -bottom-1.5 left-6 size-3 rotate-45 border-b border-r border-[var(--color-accent-border)] bg-[var(--surface-modal)]" />
        </button>
      ) : null}

      <div
        className="grid h-11 grid-cols-2 border-b border-[var(--border-subtle)] bg-white/[0.03]"
        role="tablist"
        aria-label="Trade journal mode"
      >
        {MODES.map((id) => {
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
                "relative text-[13px] transition-colors",
                active
                  ? "bg-[var(--surface-modal)] font-medium text-text-primary"
                  : "bg-transparent text-text-muted hover:text-text-secondary",
              )}
            >
              {journalModeLabel(id)}
              {active ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--color-accent)]" />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
