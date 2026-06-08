"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

type CoachCollapsibleSectionProps = {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  className?: string
  children: React.ReactNode
}

export function CoachCollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  className,
  children,
}: CoachCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/[0.08] bg-black/15", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/75">
            {title}
          </p>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-foreground/80">{subtitle}</p>
          ) : null}
        </div>
        {open ? (
          <ChevronUp className="size-3.5 shrink-0 text-muted-foreground/70" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground/70" />
        )}
      </button>
      {open ? <div className="space-y-2 border-t border-white/[0.06] px-3 py-3">{children}</div> : null}
    </div>
  )
}
