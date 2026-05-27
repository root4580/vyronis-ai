"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { DashboardCard, DashboardCardBody } from "@/components/dashboard/dashboard-primitives"

export function AnalyticsMetricSkeleton() {
  return (
    <DashboardCard className="glass-card">
      <DashboardCardBody className="space-y-3 pt-4">
        <Skeleton className="h-3 w-24 skeleton-shimmer" />
        <Skeleton className="h-8 w-28 skeleton-shimmer" />
        <Skeleton className="h-3 w-32 skeleton-shimmer" />
      </DashboardCardBody>
    </DashboardCard>
  )
}

export function AnalyticsPageSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <AnalyticsMetricSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <AnalyticsMetricSkeleton key={`b-${i}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        <DashboardCard className="col-span-1 glass-card lg:col-span-2">
          <DashboardCardBody className="h-[300px] space-y-3 pt-5">
            <Skeleton className="h-4 w-40 skeleton-shimmer" />
            <Skeleton className="h-full w-full rounded-xl skeleton-shimmer" />
          </DashboardCardBody>
        </DashboardCard>
        <DashboardCard className="glass-card">
          <DashboardCardBody className="h-[300px] pt-5">
            <Skeleton className="h-full w-full rounded-xl skeleton-shimmer" />
          </DashboardCardBody>
        </DashboardCard>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:gap-4">
        <DashboardCard className="glass-card">
          <DashboardCardBody className="h-[280px] pt-5">
            <Skeleton className="h-full w-full rounded-xl skeleton-shimmer" />
          </DashboardCardBody>
        </DashboardCard>
        <DashboardCard className="glass-card">
          <DashboardCardBody className="h-[280px] pt-5">
            <Skeleton className="h-full w-full rounded-xl skeleton-shimmer" />
          </DashboardCardBody>
        </DashboardCard>
      </div>
    </div>
  )
}
