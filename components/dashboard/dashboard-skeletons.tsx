"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { DashboardCard, DashboardCardBody } from "@/components/dashboard/dashboard-primitives"

export function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <DashboardCard key={i} className="glass-card">
          <DashboardCardBody className="pt-4">
            <Skeleton className="h-3 w-24 skeleton-shimmer" />
            <Skeleton className="mt-3 h-8 w-32 skeleton-shimmer" />
            <Skeleton className="mt-3 h-3 w-20 skeleton-shimmer" />
          </DashboardCardBody>
        </DashboardCard>
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <DashboardCard className="col-span-2 glass-card">
      <DashboardCardBody className="h-[280px] md:h-[300px] space-y-3 pt-5">
        <Skeleton className="h-4 w-40 skeleton-shimmer" />
        <Skeleton className="h-full w-full rounded-xl skeleton-shimmer" />
      </DashboardCardBody>
    </DashboardCard>
  )
}

export function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8">
      <StatsCardsSkeleton />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
        <ChartSkeleton />
        <DashboardCard className="glass-card">
          <DashboardCardBody className="h-[280px] md:h-[300px] pt-5">
            <Skeleton className="h-full w-full rounded-xl skeleton-shimmer" />
          </DashboardCardBody>
        </DashboardCard>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
        <DashboardCard className="glass-card">
          <DashboardCardBody className="h-[260px] pt-5">
            <Skeleton className="h-full w-full rounded-xl skeleton-shimmer" />
          </DashboardCardBody>
        </DashboardCard>
        <DashboardCard className="glass-card">
          <DashboardCardBody className="h-[260px] pt-5">
            <Skeleton className="h-full w-full rounded-xl skeleton-shimmer" />
          </DashboardCardBody>
        </DashboardCard>
      </div>
    </div>
  )
}

export function TableSkeleton() {
  return (
    <DashboardCard className="glass-card">
      <DashboardCardBody className="space-y-3 pt-4">
        <Skeleton className="h-9 w-full skeleton-shimmer" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full skeleton-shimmer" />
        ))}
      </DashboardCardBody>
    </DashboardCard>
  )
}

export function StrategyPerformanceSkeleton() {
  return (
    <DashboardCard className="glass-card overflow-hidden">
      <DashboardCardBody className="space-y-4 pt-5">
        <Skeleton className="h-5 w-48 skeleton-shimmer" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Skeleton className="h-24 w-full rounded-xl skeleton-shimmer" />
          <Skeleton className="h-24 w-full rounded-xl skeleton-shimmer" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl skeleton-shimmer" />
        ))}
      </DashboardCardBody>
    </DashboardCard>
  )
}
