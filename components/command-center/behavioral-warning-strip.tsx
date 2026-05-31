"use client"

import { AlertTriangle, Info, ShieldAlert } from "lucide-react"
import type { CommandCenterWarning } from "@/lib/command-center/types"
import { cn } from "@/lib/utils"

type BehavioralWarningStripProps = {
  warnings: CommandCenterWarning[]
  className?: string
}

const severityStyles = {
  info: {
    border: "border-cyan-glow/20",
    bg: "bg-cyan-glow/[0.06]",
    text: "text-cyan-glow/90",
    icon: Info,
  },
  warning: {
    border: "border-warning/25",
    bg: "bg-warning/[0.08]",
    text: "text-warning-muted/90",
    icon: AlertTriangle,
  },
  critical: {
    border: "border-loss/30",
    bg: "bg-loss/[0.1]",
    text: "text-loss/90",
    icon: ShieldAlert,
  },
}

export function BehavioralWarningStrip({ warnings, className }: BehavioralWarningStripProps) {
  if (warnings.length === 0) return null

  const primary = warnings[0]
  const styles = severityStyles[primary.severity]
  const Icon = styles.icon

  return (
    <div className={cn("command-center-warning-strip space-y-2", className)}>
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
          styles.border,
          styles.bg,
        )}
      >
        <Icon className={cn("mt-0.5 size-4 shrink-0", styles.text)} />
        <div className="min-w-0">
          <p className={cn("text-[11px] font-semibold uppercase tracking-[0.08em]", styles.text)}>
            {primary.title}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-foreground/85">{primary.message}</p>
        </div>
      </div>
      {warnings.length > 1 ? (
        <p className="px-1 text-[10px] text-muted-foreground/70">
          +{warnings.length - 1} more signal{warnings.length - 1 === 1 ? "" : "s"} in memory
        </p>
      ) : null}
    </div>
  )
}
