"use client"

import { Shield } from "lucide-react"
import { cn } from "@/lib/utils"

type SessionRulesStripProps = {
  summary: string
  className?: string
}

export function SessionRulesStrip({ summary, className }: SessionRulesStripProps) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-xl border border-cyan-glow/20 bg-cyan-glow/[0.05] px-3 py-2 backdrop-blur-sm",
        className,
      )}
    >
      <p className="flex items-start gap-2 text-[11px] leading-snug text-foreground/88">
        <Shield className="mt-0.5 size-3.5 shrink-0 text-cyan-glow/90" />
        <span>{summary}</span>
      </p>
    </div>
  )
}
