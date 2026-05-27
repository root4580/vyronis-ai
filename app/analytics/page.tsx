"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, BarChart3, Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
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
    <div className="min-h-screen bg-background">
      <header className="dashboard-header border-b border-white/[0.06]">
        <div className="dashboard-container flex items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex size-9 items-center justify-center rounded-[10px] border border-cyan-glow/20 bg-gradient-to-br from-cyan-glow/15 to-profit/10 glow-cyan">
              <Zap className="size-[18px] text-cyan-glow" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold leading-none tracking-tight">Vyronis Analytics</h1>
              <p className="mt-1 text-[11px] text-muted-foreground/70">Phase 1 · Performance Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden border-white/[0.08] bg-white/[0.02] sm:inline-flex"
            >
              <Link href="/">
                <BarChart3 className="mr-1.5 size-3.5" />
                Dashboard
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-white/[0.08] bg-white/[0.02]"
            >
              <Link href="/">
                <ArrowLeft className="mr-1.5 size-3.5" />
                Journal
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="dashboard-container px-4 py-6 md:px-6 md:py-8">
        <div className="analytics-fade-in mb-6 opacity-0" style={{ animationFillMode: "forwards" }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">
            Real-time journal analytics
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            Trading Performance Dashboard
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground/75">
            Institutional-grade metrics powered by your Supabase trade history — win rate, equity curve,
            setup quality, emotions, and weekly trends.
          </p>
        </div>

        {isLoading ? (
          <AnalyticsPageSkeleton />
        ) : (
          <div className="space-y-8">
            <WeeklyReviewPanel
              refreshKey={analytics.tradeCount}
              trades={rawTrades}
              maxRiskPerTrade={maxRiskPerTrade}
            />
            <AnalyticsDashboard analytics={analytics} startingBalance={startingBalance} />
          </div>
        )}
      </main>

      <Toaster />
    </div>
  )
}
