"use client"

import Link from "next/link"
import { JOURNAL_WORKFLOW_STEPS } from "@/lib/journal/journal-workflow"
import { cn } from "@/lib/utils"

export function JournalWorkflowNav({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-white/[0.08] bg-black/30 p-2",
        className,
      )}
    >
      <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-[0.12em] text-cyan-glow/70">
        Decision workflow
      </p>
      <div className="flex min-w-max gap-1 sm:min-w-0 sm:flex-wrap">
        {JOURNAL_WORKFLOW_STEPS.map((step, i) => (
          <Link
            key={step.id}
            href={step.href}
            className="group flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-cyan-glow/25 hover:bg-cyan-glow/[0.06] sm:min-w-0 sm:flex-1"
          >
            <span className="text-[9px] tabular-nums text-muted-foreground/50">{i + 1}</span>
            <span className="text-[10px] font-medium text-foreground/85 group-hover:text-cyan-glow">
              {step.shortLabel}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
