"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

type MessageHistoryToggleProps = {
  count: number
  label?: string
  className?: string
  children: React.ReactNode
}

export function MessageHistoryToggle({
  count,
  label = "earlier messages",
  className,
  children,
}: MessageHistoryToggleProps) {
  const [open, setOpen] = useState(false)
  if (count <= 0) return null

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-[10px] font-medium text-muted-foreground/75 hover:text-cyan-glow"
      >
        View {count} {label}
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>
      {open ? <div className="space-y-2 opacity-80">{children}</div> : null}
    </div>
  )
}
