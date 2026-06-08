"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { CouncilNewsRiskBar } from "@/components/economic-calendar/council-news-risk-bar"
import { useEconomicCalendar } from "@/hooks/use-economic-calendar"
import { getDashboardHomeHref } from "@/lib/dashboard-nav"

export function EconomicNewsWorkspace() {
  const { calendar, loading, error, reload } = useEconomicCalendar()

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-12">
      <header className="space-y-2">
        <Link
          href={getDashboardHomeHref()}
          className="inline-flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-accent"
        >
          <ArrowLeft className="size-3.5" />
          HQ Dashboard
        </Link>
        <div>
          <h1 className="text-lg font-medium text-text-primary">Economic Calendar</h1>
          <p className="mt-0.5 text-[12px] text-text-muted">
            Today&apos;s releases, impact levels, forecast vs previous, and pair risk guidance.
          </p>
        </div>
      </header>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-loss/25 bg-loss/[0.06] px-3.5 py-3">
          <p className="text-[12px] text-loss/90">{error}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-2 text-[11px] font-medium text-text-accent hover:underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      <CouncilNewsRiskBar calendar={calendar} loading={loading} />
    </div>
  )
}
