"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BookOpen, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardEmptyState } from "@/components/dashboard/dashboard-primitives"
import type { DashboardTradeRow } from "@/components/dashboard/trading-components"
import { JournalFilterBar } from "@/components/journal/journal-filter-bar"
import { JournalTradeCards } from "@/components/journal/journal-trade-cards"
import {
  DEFAULT_JOURNAL_FILTERS,
  filterAndSortTrades,
  getJournalFilterOptions,
  type JournalFilters,
} from "@/lib/journal-utils"
import { APP_HOME_PATH } from "@/lib/branding"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"

type JournalTradesListProps = {
  trades: DashboardTradeRow[]
  onViewTrade?: (trade: DashboardTradeRow) => void
  onEdit?: (trade: DashboardTradeRow) => void
  onDelete?: (trade: DashboardTradeRow) => void
  onScreenshotClick?: (trade: DashboardTradeRow) => void
  onLogTrade?: () => void
}

export function JournalTradesList({
  trades,
  onViewTrade,
  onEdit,
  onDelete,
  onScreenshotClick,
  onLogTrade,
}: JournalTradesListProps) {
  const [filters, setFilters] = useState<JournalFilters>(DEFAULT_JOURNAL_FILTERS)
  const [plansById, setPlansById] = useState<Map<string, MatchableTradePlan>>(new Map())

  useEffect(() => {
    let cancelled = false

    async function loadPlans() {
      const linkedIds = trades.filter((t) => t.plan_id).map((t) => t.plan_id as string)
      if (linkedIds.length === 0) {
        setPlansById(new Map())
        return
      }

      try {
        const response = await fetch("/api/trade-plans")
        if (!response.ok) return
        const payload = (await response.json()) as { plans?: MatchableTradePlan[] }
        if (cancelled) return
        const map = new Map<string, MatchableTradePlan>()
        for (const plan of payload.plans ?? []) {
          map.set(plan.id, plan)
        }
        setPlansById(map)
      } catch {
        if (!cancelled) setPlansById(new Map())
      }
    }

    void loadPlans()
    return () => {
      cancelled = true
    }
  }, [trades])

  const filterOptions = useMemo(() => getJournalFilterOptions(trades), [trades])
  const filteredTrades = useMemo(
    () => filterAndSortTrades(trades, filters, "date", "desc"),
    [trades, filters],
  )

  if (trades.length === 0) {
    return (
      <DashboardEmptyState
        icon={BookOpen}
        title="No trades logged yet"
        description="Log your first trade to start building your journal."
        className="min-h-[200px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)]"
      >
        {onLogTrade ? (
          <Button type="button" size="sm" className="mt-3 btn-primary" onClick={onLogTrade}>
            Log your first trade
          </Button>
        ) : (
          <Button asChild size="sm" className="mt-3 btn-primary">
            <Link href={`${APP_HOME_PATH}?action=new-trade`}>Log your first trade</Link>
          </Button>
        )}
      </DashboardEmptyState>
    )
  }

  return (
    <div className="space-y-3">
      <JournalFilterBar
        filters={filters}
        options={filterOptions}
        tradeCount={trades.length}
        filteredCount={filteredTrades.length}
        onChange={setFilters}
      />

      {filteredTrades.length === 0 ? (
        <DashboardEmptyState
          icon={BookOpen}
          title="No trades match filters"
          description="Try clearing filters or logging a new trade."
          className="min-h-[140px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)]"
        />
      ) : (
        <JournalTradeCards
          trades={filteredTrades}
          plansById={plansById}
          variant="compact"
          onViewTrade={onViewTrade}
          onEdit={onEdit}
          onDelete={onDelete}
          onScreenshotClick={onScreenshotClick}
        />
      )}

      {onLogTrade ? (
        <Button type="button" variant="outline" className="h-9 w-full border-[var(--border-subtle)] sm:w-auto" onClick={onLogTrade}>
          <Plus className="mr-2 size-4" />
          Log trade
        </Button>
      ) : null}
    </div>
  )
}
