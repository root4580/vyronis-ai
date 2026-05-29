"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { JOURNAL_WORKFLOW_STEPS } from "@/lib/journal/journal-workflow"
import { cn } from "@/lib/utils"

function stepActive(href: string, pathname: string | null, searchTab: string | null): boolean {
  if (href === "/war-room") return pathname === "/war-room"
  if (href.startsWith("/strategy-brain")) return pathname?.startsWith("/strategy-brain") ?? false
  if (href.includes("tab=journal")) return searchTab === "journal"
  if (href.includes("tab=dashboard")) return searchTab === "dashboard" || pathname === "/"
  return false
}

export function JournalWorkflowNav({ className }: { className?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchTab = searchParams.get("tab")

  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.08] bg-black/30 p-2 sm:p-3",
        className,
      )}
    >
      <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-[0.12em] text-cyan-glow/70">
        Operating workflow
      </p>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible">
        {JOURNAL_WORKFLOW_STEPS.map((step, i) => {
          const active = stepActive(step.href, pathname, searchTab)
          return (
            <Link
              key={step.id}
              href={step.href}
              title={step.description}
              className={cn(
                "flex min-w-[4.25rem] shrink-0 flex-col rounded-lg border px-2 py-2 sm:min-w-0 sm:flex-1",
                active
                  ? "border-cyan-glow/30 bg-cyan-glow/[0.08]"
                  : "border-transparent bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.04]",
              )}
            >
              <span className="text-[9px] tabular-nums text-muted-foreground/45">{i + 1}</span>
              <span
                className={cn(
                  "text-[10px] font-medium leading-tight",
                  active ? "text-cyan-glow" : "text-foreground/85",
                )}
              >
                {step.shortLabel}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
