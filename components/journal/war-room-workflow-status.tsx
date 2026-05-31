"use client"

import Link from "next/link"
import type { WarRoomReadiness } from "@/lib/journal/war-room-status"
import { cn } from "@/lib/utils"

const WORKFLOW_TABS = [
  { id: "plan", label: "Plan", href: "#war-room-planning" },
  { id: "aoi", label: "AOI", href: "#war-room-pairs" },
  { id: "setup", label: "Setup", href: "/strategy-brain" },
  { id: "emotion", label: "Emotion", href: "/strategy-brain" },
  { id: "decide", label: "Decide", href: "/hq" },
] as const

export function WarRoomWorkflowStatus({ readiness }: { readiness: WarRoomReadiness }) {
  const displaySteps = readiness.steps.slice(0, 4)
  const complete = readiness.percent >= 100

  return (
    <div className="war-room-surface-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-medium text-text-muted">Mission control</p>
        <div className="flex items-center gap-2">
          <div className="h-1 w-[120px] overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                complete ? "bg-profit" : "bg-[var(--warning)]",
              )}
              style={{ width: `${readiness.percent}%` }}
            />
          </div>
          <span
            className={cn(
              "text-[11px] font-medium tabular-nums",
              complete ? "text-profit" : "text-[var(--warning)]",
            )}
          >
            {readiness.percent}%
          </span>
        </div>
      </div>

      <p className="mt-1 text-[12px] font-medium text-text-primary">{readiness.headline}</p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {displaySteps.map((step) => (
          <div
            key={step.id}
            className={cn(
              "rounded-[var(--radius-sm)] border px-3 py-2.5",
              step.complete
                ? "border-[var(--color-accent-border)] bg-[rgb(from_var(--color-accent)_r_g_b_/_0.05)]"
                : "border-[var(--border-subtle)] bg-white/[0.03]",
            )}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  step.complete ? "bg-[var(--color-accent)]" : "bg-white/15",
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "text-[12px] font-medium",
                  step.complete ? "text-text-accent" : "text-text-secondary",
                )}
              >
                {step.label}
              </span>
            </div>
            <p
              className={cn(
                "mt-0.5 line-clamp-2 text-[11px]",
                step.complete
                  ? "text-[rgb(from_var(--color-accent)_r_g_b_/_0.6)]"
                  : "text-text-muted",
              )}
            >
              {step.hint}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {WORKFLOW_TABS.map((tab, index) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "rounded-[var(--radius-sm)] border px-2.5 py-1 text-[11px] transition-colors",
              index === 0
                ? "border-[var(--border-default)] bg-white/[0.06] text-text-primary"
                : "border-[var(--border-subtle)] bg-transparent text-text-muted hover:border-[var(--border-default)] hover:text-text-secondary",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
