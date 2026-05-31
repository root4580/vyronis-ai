"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function AuthShellSkeleton() {
  return (
    <div className="w-full max-w-md space-y-4" role="status" aria-label="Loading sign in">
      <div className="space-y-2 text-center">
        <Skeleton className="mx-auto h-7 w-40 skeleton-shimmer" />
        <Skeleton className="mx-auto h-4 w-56 skeleton-shimmer" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl skeleton-shimmer" />
      <Skeleton className="h-11 w-full rounded-xl skeleton-shimmer" />
      <Skeleton className="h-11 w-full rounded-xl skeleton-shimmer" />
    </div>
  )
}
