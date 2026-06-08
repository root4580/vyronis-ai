"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { DailyClosePanel } from "@/components/journal/daily-close-panel"
import { getTodayTrades } from "@/lib/user-settings"
import { getDashboardHomeHref } from "@/lib/dashboard-nav"
import type { DashboardTradeRow } from "@/components/dashboard/trading-components"

export function DailyCloseWorkspace({
  accountId,
  trades,
}: {
  accountId: string
  trades: DashboardTradeRow[]
}) {
  const todayTrades = getTodayTrades(trades)
  const todayWinCount = todayTrades.filter((trade) => trade.result === "WIN").length
  const todayLossCount = todayTrades.filter((trade) => trade.result === "LOSS").length

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-12">
      <header className="space-y-2">
        <Link
          href={getDashboardHomeHref()}
          className="inline-flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-accent"
        >
          <ArrowLeft className="size-3.5" />
          HQ Dashboard
        </Link>
        <div>
          <h1 className="text-lg font-medium text-text-primary">Close the day</h1>
          <p className="mt-0.5 text-[12px] text-text-muted">
            Lock in tomorrow&apos;s focus before you step away from the desk.
          </p>
        </div>
      </header>

      <DailyClosePanel
        accountId={accountId}
        todayTradeCount={todayTrades.length}
        todayWinCount={todayWinCount}
        todayLossCount={todayLossCount}
      />
    </div>
  )
}
