"use client"

import { useState } from "react"
import { ChevronDown, Plug } from "lucide-react"
import { Mt5ConnectionPanel } from "@/components/journal/mt5-connection-panel"
import { cn } from "@/lib/utils"

/**
 * MT5 automation — paused, kept for future use. Collapsed by default.
 */
export function Mt5IntegrationsCollapsible({
  onTradeSynced,
  className,
}: {
  onTradeSynced?: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn("rounded-xl border border-white/[0.06] bg-white/[0.02]", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground/85">
          <Plug className="size-3.5 text-muted-foreground/60" />
          MT5 auto-sync (coming later)
        </span>
        <ChevronDown
          className={cn("size-4 text-muted-foreground/50 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="border-t border-white/[0.06] p-2">
          <p className="mb-2 px-1 text-[10px] leading-relaxed text-muted-foreground/60">
            Manual journaling is the primary workflow. MT5 EA sync is experimental — expand when
            automation returns.
          </p>
          <Mt5ConnectionPanel onTradeSynced={onTradeSynced} className="border-0 shadow-none" />
        </div>
      ) : null}
    </div>
  )
}
