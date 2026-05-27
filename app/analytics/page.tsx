"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { DashboardAppShell } from "@/components/dashboard/dashboard-app-shell"
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard"
import { AnalyticsPageSkeleton } from "@/components/analytics/analytics-skeleton"
import { WeeklyReviewPanel } from "@/components/weekly-review/weekly-review-panel"
import { buildDashboardAnalytics } from "@/lib/analytics/dashboard-analytics"
import {
  fetchUserStartingBalance,
  fetchUserTradesForAnalytics,
} from "@/lib/analytics/fetch-trades"
import type { AnalyticsTradeRow } from "@/lib/analytics/types"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"

export default function AnalyticsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [startingBalance, setStartingBalance] = useState(10000)
  const [maxRiskPerTrade, setMaxRiskPerTrade] = useState(DEFAULT_USER_SETTINGS.max_risk_per_trade)
  const [rawTrades, setRawTrades] = useState<AnalyticsTradeRow[]>([])
  const [analytics, setAnalytics] = useState(() => buildDashboardAnalytics([]))

  useEffect(() => {
    let cancelled = false

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (cancelled) return

      if (!user) {
        router.replace("/auth/login?next=/analytics")
        return
      }

      const [tradesResult, balance, settingsResult] = await Promise.all([
        fetchUserTradesForAnalytics(supabase, user.id),
        fetchUserStartingBalance(supabase, user.id),
        supabase
          .from("user_settings")
          .select("max_risk_per_trade")
          .eq("user_id", user.id)
          .maybeSingle(),
      ])

      if (cancelled) return

      if (tradesResult.error) {
        toast({
          title: "Could not load trades",
          description: tradesResult.error,
          variant: "destructive",
        })
      }

      setStartingBalance(balance)
      setRawTrades(tradesResult.trades)
      setMaxRiskPerTrade(
        typeof settingsResult.data?.max_risk_per_trade === "number" &&
          settingsResult.data.max_risk_per_trade > 0
          ? settingsResult.data.max_risk_per_trade
          : DEFAULT_USER_SETTINGS.max_risk_per_trade,
      )
      setAnalytics(buildDashboardAnalytics(tradesResult.trades, balance))
      setIsLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [router, supabase, toast])

  return (
    <DashboardAppShell
      activeTab="analytics"
      onOpenSettings={() => router.push("/profile")}
    >
      <section className="dashboard-section">
        <p className="dashboard-section-title">Analytics</p>
        <p className="max-w-2xl text-sm text-muted-foreground/75">
          Win rate, equity curve, setup quality, and emotion patterns from your journal.
        </p>
      </section>

      {isLoading ? (
        <AnalyticsPageSkeleton />
      ) : (
        <div className="space-y-8">
          <section className="dashboard-section">
            <p className="dashboard-section-title">Weekly AI Review</p>
            <WeeklyReviewPanel
              refreshKey={analytics.tradeCount}
              trades={rawTrades}
              maxRiskPerTrade={maxRiskPerTrade}
            />
          </section>

          <section className="dashboard-section">
            <p className="dashboard-section-title">Performance</p>
            <AnalyticsDashboard analytics={analytics} startingBalance={startingBalance} />
          </section>
        </div>
      )}

      <Toaster />
    </DashboardAppShell>
  )
}
