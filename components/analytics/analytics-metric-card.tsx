"use client"

import type { LucideIcon } from "lucide-react"
import { DashboardCard, DashboardCardBody, DashboardMetricLabel } from "@/components/dashboard/dashboard-primitives"
import { cn } from "@/lib/utils"

type AnalyticsMetricCardProps = {
  label: string
  value: string
  subtext?: React.ReactNode
  icon: LucideIcon
  tone?: "default" | "profit" | "loss" | "cyan"
  delayMs?: number
  className?: string
}

const toneClasses = {
  default: "text-foreground",
  profit: "text-profit",
  loss: "text-loss",
  cyan: "text-cyan-glow",
}

export function AnalyticsMetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  tone = "default",
  delayMs = 0,
  className,
}: AnalyticsMetricCardProps) {
  return (
    <DashboardCard
      className={cn(
        "glass-card floating-glow analytics-fade-in opacity-0",
        className,
      )}
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: "forwards" }}
      inset
      interactive
      glow
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-cyan-glow/[0.05] to-transparent" />
      <DashboardCardBody className="relative space-y-2 pt-4">
        <div className="flex items-center justify-between gap-2">
          <DashboardMetricLabel>{label}</DashboardMetricLabel>
          <span className="dashboard-icon-chip">
            <Icon className="size-3.5 text-cyan-glow/90" />
          </span>
        </div>
        <p className={cn("text-2xl font-bold tracking-tight tabular-nums md:text-[1.65rem]", toneClasses[tone])}>
          {value}
        </p>
        {subtext && (
          <p className="text-[11px] leading-relaxed text-muted-foreground/70">{subtext}</p>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}
