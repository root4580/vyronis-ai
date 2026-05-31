"use client"

import Link from "next/link"
import { CheckCircle2, Circle } from "lucide-react"
import type { WarRoomReadiness } from "@/lib/journal/war-room-status"
import { JOURNAL_WORKFLOW_STEPS } from "@/lib/journal/journal-workflow"
import { cn } from "@/lib/utils"

export function WarRoomWorkflowStatus({ readiness }: { readiness: WarRoomReadiness }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/35 px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-warning-muted/80">
            Mission control
          </p>
          <p className="mt-0.5 text-[13px] font-medium text-foreground/92">{readiness.headline}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 min-w-[120px] overflow-hidden rounded-full bg-white/[0.06] sm:max-w-[140px]">
            <div
              className="h-full rounded-full bg-warning/70 transition-[width]"
              style={{ width: `${readiness.percent}%` }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground/80">
            {readiness.percent}%
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
        {readiness.steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              "rounded-lg border px-2 py-1.5",
              step.complete
                ? "border-profit/20 bg-profit/[0.05]"
                : "border-white/[0.06] bg-white/[0.02]",
            )}
          >
            <div className="flex items-center gap-1">
              {step.complete ? (
                <CheckCircle2 className="size-3 shrink-0 text-profit" />
              ) : (
                <Circle className="size-3 shrink-0 text-muted-foreground/40" />
              )}
              <span className="text-[10px] font-medium">{step.label}</span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-muted-foreground/65">
              {step.hint}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
        {JOURNAL_WORKFLOW_STEPS.slice(0, 5).map((step) => (
          <Link
            key={step.id}
            href={step.href}
            className="shrink-0 rounded-md border border-white/[0.06] px-2 py-1 text-[9px] text-muted-foreground hover:border-cyan-glow/25 hover:text-cyan-glow"
          >
            {step.shortLabel}
          </Link>
        ))}
      </div>
    </div>
  )
}
