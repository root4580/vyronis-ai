"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { AccountSettingsModal } from "@/components/dashboard/account-settings-modal"
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard"
import { AnalyticsPageSkeleton } from "@/components/analytics/analytics-skeleton"
import { TradeLearningPanel } from "@/components/dashboard/trade-learning-panel"
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome"
import { WeeklyReviewPanel } from "@/components/weekly-review/weekly-review-panel"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { buildDashboardAnalytics } from "@/lib/analytics/dashboard-analytics"
import {
  fetchUserStartingBalance,
  fetchUserTradesForAnalytics,
} from "@/lib/analytics/fetch-trades"
import type { AnalyticsTradeRow } from "@/lib/analytics/types"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import { getSignedPnL } from "@/lib/trade-utils"
import { useAccountSettingsModal } from "@/hooks/use-account-settings-modal"
import { useDashboardChrome } from "@/hooks/use-dashboard-chrome"

export default function AnalyticsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const chrome = useDashboardChrome({ loginNextPath: "/analytics" })

  const [isLoading, setIsLoading] = useState(true)
  const [startingBalance, setStartingBalance] = useState(10000)
  const [rawTrades, setRawTrades] = useState<AnalyticsTradeRow[]>([])
  const [analytics, setAnalytics] = useState(() => buildDashboardAnalytics([]))

  const settings = useAccountSettingsModal(chrome.supabase, chrome.user?.id)

  const maxRiskPerTrade = settings.form.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade

  const { accountBalance, totalPnL } = useMemo(() => {
    const pnl = rawTrades.reduce((sum, trade) => sum + getSignedPnL(trade.pnl, trade.result), 0)
    return {
      totalPnL: pnl,
      accountBalance: startingBalance + pnl,
    }
  }, [rawTrades, startingBalance])

  useEffect(() => {
    if (!chrome.user?.id) return

    let cancelled = false

    async function load() {
      const userId = chrome.user!.id

      const [tradesResult, balance] = await Promise.all([
        fetchUserTradesForAnalytics(chrome.supabase, userId),
        fetchUserStartingBalance(chrome.supabase, userId),
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
      setAnalytics(buildDashboardAnalytics(tradesResult.trades, balance))
      setIsLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [chrome.supabase, chrome.user?.id, toast])

  if (chrome.isLoggingOut) {
    return <SigningOutScreen />
  }

  if (!chrome.isAuthReady) {
    return <AnalyticsPageSkeleton />
  }

  return (
    <>
      <DashboardChrome
        activeTab="analytics"
        profileCard={chrome.profileCard}
        showProfileEmptyHint={chrome.showProfileEmptyHint}
        onOpenSettings={settings.openSettings}
        onLogout={() => void chrome.handleLogout()}
        isLoggingOut={chrome.isLoggingOut}
        showSignalBell={Boolean(chrome.user)}
        showFab
        onFabClick={() => router.push("/?action=new-trade")}
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
                onViewTrade={(tradeId) =>
                  router.push(`/?tab=journal&trade=${encodeURIComponent(tradeId)}`)
                }
              />
            </section>

            <section className="dashboard-section">
              <p className="dashboard-section-title">Trader evolution (Vyronis OS)</p>
              <p className="mb-3 max-w-2xl text-sm text-muted-foreground/75">
                Discipline trends, strategy intelligence, replay simulator, and intelligence timeline.
              </p>
              <a
                href="/evolution"
                className="inline-flex text-sm font-medium text-cyan-glow/90 hover:text-cyan-glow"
              >
                Open evolution dashboard →
              </a>
            </section>

            <section className="dashboard-section">
              <p className="dashboard-section-title">Trade Memory + Learning</p>
              <TradeLearningPanel refreshKey={analytics.tradeCount} />
            </section>

            <section className="dashboard-section">
              <p className="dashboard-section-title">Performance</p>
              <AnalyticsDashboard analytics={analytics} startingBalance={startingBalance} />
            </section>
          </div>
        )}
      </DashboardChrome>

      <AccountSettingsModal
        open={settings.isOpen}
        onClose={settings.closeSettings}
        form={settings.form}
        onFormChange={(updates) => settings.setForm((prev) => ({ ...prev, ...updates }))}
        onSubmit={(event) => void settings.saveSettings(event)}
        isSaving={settings.isSaving}
        accountBalance={accountBalance}
        totalPnL={totalPnL}
      />

      <Toaster />
    </>
  )
}
