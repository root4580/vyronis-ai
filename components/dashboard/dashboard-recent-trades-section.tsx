"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { JournalTradeCards } from "@/components/journal/journal-trade-cards"
import type { DashboardTradeRow } from "@/components/dashboard/trading-components"
import { cn } from "@/lib/utils"

type DashboardRecentTradesSectionProps = {
  trades: DashboardTradeRow[]
  limit?: number
  variant?: "default" | "compact"
  onViewTrade?: (trade: DashboardTradeRow) => void
  onEdit?: (trade: DashboardTradeRow) => void
  onDelete?: (trade: DashboardTradeRow) => void
  onScreenshotClick?: (trade: DashboardTradeRow) => void
  onSeeAll?: () => void
  className?: string
}

export function DashboardRecentTradesSection({
  trades,
  limit = 5,
  variant = "default",
  onViewTrade,
  onEdit,
  onDelete,
  onScreenshotClick,
  onSeeAll,
  className,
}: DashboardRecentTradesSectionProps) {
  const recent = useMemo(() => {
    return [...trades]
      .sort((a, b) => {
        const da = a.trade_date ?? a.created_at ?? ""
        const db = b.trade_date ?? b.created_at ?? ""
        return db.localeCompare(da)
      })
      .slice(0, limit)
  }, [trades, limit])

  if (recent.length === 0) return null

  const compact = variant === "compact"

  return (
    <section
      className={cn(
        "vyronis-surface",
        compact ? "p-2.5 sm:p-3" : "p-3 sm:p-4",
        className,
      )}
      aria-label="Recent trades"
    >
      <div className={cn("flex items-center justify-between gap-2", compact ? "mb-2" : "mb-3")}>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/65">
          Recent trades
        </p>
        {onSeeAll ? (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSeeAll}
              className="h-7 gap-1 px-2 text-[10px] text-cyan-glow/90 hover:text-cyan-glow"
            >
              Calendar
              <ArrowRight className="size-3" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            asChild
            className="h-7 shrink-0 gap-1 px-2 text-[10px] text-cyan-glow/90"
          >
            <Link href="/?tab=journal">
              Calendar
              <ArrowRight className="size-3" />
            </Link>
          </Button>
        )}
      </div>
      <JournalTradeCards
        trades={recent}
        onViewTrade={onViewTrade}
        onEdit={onEdit}
        onDelete={onDelete}
        onScreenshotClick={onScreenshotClick}
      />
    </section>
  )
}
