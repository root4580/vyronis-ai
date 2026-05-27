"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

/* ── Chart tokens (TradingView-inspired) ── */
export const CHART_GRID = {
  strokeDasharray: "2 6",
  stroke: "rgba(255,255,255,0.04)",
  vertical: false,
} as const

export const CHART_AXIS = {
  stroke: "rgba(255,255,255,0.18)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const

export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "rgba(8, 10, 16, 0.96)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  fontSize: "12px",
  boxShadow: "0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03)",
  backdropFilter: "blur(12px)",
  padding: "8px 12px",
}

type DashboardCardProps = React.ComponentProps<typeof Card> & {
  interactive?: boolean
  glow?: boolean
  inset?: boolean
}

export function DashboardCard({
  className,
  interactive = false,
  glow = false,
  inset = false,
  children,
  ...props
}: DashboardCardProps) {
  return (
    <Card
      className={cn(
        "dashboard-card gap-0 overflow-hidden py-0 shadow-none",
        interactive && "dashboard-card-interactive",
        glow && "dashboard-card-glow",
        inset && "dashboard-chart-surface",
        className,
      )}
      {...props}
    >
      {children}
    </Card>
  )
}

type DashboardCardHeaderProps = {
  title: string
  icon: LucideIcon
  badge?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function DashboardCardHeader({
  title,
  icon: Icon,
  badge,
  action,
  className,
}: DashboardCardHeaderProps) {
  return (
    <CardHeader className={cn("dashboard-card-header", className)}>
      <div className="flex items-center justify-between gap-3">
        <CardTitle className="dashboard-card-title">
          <span className="dashboard-icon-chip">
            <Icon className="size-3.5" />
          </span>
          {title}
        </CardTitle>
        <div className="flex items-center gap-2 shrink-0">
          {badge}
          {action}
        </div>
      </div>
    </CardHeader>
  )
}

export function DashboardCardBody({
  className,
  ...props
}: React.ComponentProps<typeof CardContent>) {
  return <CardContent className={cn("dashboard-card-body", className)} {...props} />
}

export function DashboardMetricLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("dashboard-metric-label", className)}>{children}</p>
}

export function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn("dashboard-empty-state", className)}>
      <div className="dashboard-empty-icon">
        <Icon className="size-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground/55 mt-1 max-w-[220px]">{description}</p>}
    </div>
  )
}

export function DashboardStatIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="dashboard-stat-icon">
      <Icon className="size-[18px] text-cyan-glow" />
    </div>
  )
}

export function DashboardInsetPanel({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn("dashboard-inset-panel", className)}>{children}</div>
}
