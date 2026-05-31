import { DashboardOverviewSkeleton } from "@/components/dashboard/dashboard-skeletons"

export default function HqLoading() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="border-b border-white/[0.06] bg-black/40 px-4 py-4 backdrop-blur-md md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="hidden h-9 w-48 animate-pulse rounded-lg bg-white/[0.06] sm:block" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-3 py-6 md:px-6">
        <DashboardOverviewSkeleton />
      </div>
    </div>
  )
}
