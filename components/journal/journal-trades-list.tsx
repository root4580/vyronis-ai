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
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"
import { APP_HOME_PATH } from "@/lib/branding"

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
      try {
        const res = await fetch("/api/trade-plans")
        const payload = await res.json().catch(() => ({}))
        if (cancelled) return
        const map = new Map<string, MatchableTradePlan>()
        for (const row of payload.plans ?? []) {
          map.set(String(row.id), {
            id: String(row.id),
            pair: String(row.pair),
            direction: row.direction,
            status: row.status,
            created_at: String(row.created_at),
            accountSize: Number(row.accountSize),
            entryPrice: Number(row.entryPrice),
            stopLoss: Number(row.stopLoss),
            takeProfit: Number(row.takeProfit),
            recommendedLots: row.recommendedLots != null ? Number(row.recommendedLots) : null,
            riskAmount: Number(row.riskAmount),
            rr: row.rr != null ? Number(row.rr) : null,
            riskPercent: Number(row.riskPercent),
          })
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
  }, [trades.length])

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
          onViewTrade={onViewTrade}
          onEdit={onEdit}
          onDelete={onDelete}
          onScreenshotClick={onScreenshotClick}
        />
      )}

      {onLogTrade ? (
        <button
          type="button"
          onClick={onLogTrade}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] text-[13px] font-medium text-text-accent transition-colors hover:opacity-90"
        >
          <Plus className="size-4" />
          Log trade
        </button>
      ) : null}
    </div>
  )
}
