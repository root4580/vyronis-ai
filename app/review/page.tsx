"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { AppTabShell } from "@/components/shell/app-tab-shell"
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard"
import { AnalyticsStickyNav } from "@/components/analytics/analytics-sticky-nav"
import { AnalyticsPageSkeleton } from "@/components/analytics/analytics-skeleton"
import { TradeLearningPanel } from "@/components/dashboard/trade-learning-panel"
import { WeeklyReviewPanel } from "@/components/weekly-review/weekly-review-panel"
import { PaperVsLivePanel } from "@/components/analytics/paper-vs-live-panel"
import { ChapterTimelinePanel } from "@/components/weekly-chapters/chapter-timeline-panel"
import { buildDashboardAnalytics } from "@/lib/analytics/dashboard-analytics"
import {
  fetchUserStartingBalance,
  fetchUserTradesForAnalytics,
} from "@/lib/analytics/fetch-trades"
import type { AnalyticsTradeRow } from "@/lib/analytics/types"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import { useAccountSettingsModal } from "@/hooks/use-account-settings-modal"
import { useDashboardChrome } from "@/hooks/use-dashboard-chrome"

/**
 * Review tab — consolidates Analytics' performance dashboard, the weekly AI
 * review, the chapter timeline ("trading story"), paper-vs-live comparison,
 * and trade memory/learning into one screen. Reuses the same content
 * components as the old /analytics page verbatim (no logic duplicated);
 * /analytics stays reachable at its old URL until the redesign fully
 * retires it.
 */
export default function ReviewPage() {
  const router = useRouter()
  const { toast } = useToast()
  const chrome = useDashboardChrome({ loginNextPath: "/review" })
  const settings = useAccountSettingsModal(chrome.supabase, chrome.user?.id)

  const [isLoading, setIsLoading] = useState(true)
  const [startingBalance, setStartingBalance] = useState(10000)
  const [rawTrades, setRawTrades] = useState<AnalyticsTradeRow[]>([])
  const [analytics, setAnalytics] = useState(() => buildDashboardAnalytics([]))

  const maxRiskPerTrade = settings.form.max_risk_per_trade ?? DEFAULT_USER_SETTINGS.max_risk_per_trade

  useEffect(() => {
    if (!chrome.user?.id) return

    let cancelled = false

    async function load() {
      const userId = chrome.user!.id

      const [tradesResult, balance] = await Promise.all([
        fetchUserTradesForAnalytics(chrome.supabase, userId, "manual", {
          accountId: chrome.activeAccountId,
          legacyAccountId: chrome.legacyTradeAccountId,
        }),
        fetchUserStartingBalance(chrome.supabase, userId, chrome.activeAccountId),
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
  }, [chrome.supabase, chrome.user?.id, chrome.activeAccountId, chrome.legacyTradeAccountId, toast])

  if (chrome.isLoggingOut) {
    return <SigningOutScreen />
  }

  if (!chrome.isAuthReady) {
    return (
      <div className="dashboard-shell">
        <div className="dashboard-container flex min-h-[60vh] items-center justify-center px-4">
          <div className="size-6 animate-spin rounded-full border-2 border-white/10 border-t-cyan-glow" />
        </div>
      </div>
    )
  }

  return (
    <>
      <AppTabShell
        activeTab="review"
        profileCard={chrome.profileCard}
        showProfileEmptyHint={chrome.showProfileEmptyHint}
        accountSwitcher={chrome.accountSwitcher}
        onOpenSettings={() => router.push("/settings")}
        onLogout={() => void chrome.handleLogout()}
        isLoggingOut={chrome.isLoggingOut}
        banner={chrome.tradingRulesBanner}
      >
        <section className="dashboard-section">
          <p className="dashboard-section-title">Review</p>
          <p className="max-w-2xl text-sm text-muted-foreground/75">
            Win rate, equity curve, setup quality, and what your trades are teaching you.
          </p>
        </section>

        {isLoading ? (
          <AnalyticsPageSkeleton />
        ) : (
          <div className="space-y-8">
            <AnalyticsStickyNav />

            <section id="analytics-weekly-review" className="dashboard-section scroll-mt-24">
              <p className="dashboard-section-title">Weekly AI review</p>
              <WeeklyReviewPanel
                refreshKey={analytics.tradeCount}
                trades={rawTrades}
                maxRiskPerTrade={maxRiskPerTrade}
                onViewTrade={(tradeId) => router.push(`/trade?trade=${encodeURIComponent(tradeId)}`)}
              />
            </section>

            <section id="analytics-chapters" className="dashboard-section scroll-mt-24">
              <p className="dashboard-section-title">Your trading story</p>
              <p className="mb-3 max-w-2xl text-sm text-muted-foreground/75">
                Every week is a chapter — green weeks and red weeks, all part of your journey.
              </p>
              <ChapterTimelinePanel accountId={chrome.activeAccountId} />
            </section>

            <section id="analytics-paper-live" className="dashboard-section scroll-mt-24">
              <p className="dashboard-section-title">Paper vs live</p>
              <p className="mb-3 max-w-2xl text-sm text-muted-foreground/75">
                Practice Room paper trades are isolated from live journal stats — compare both here.
              </p>
              <PaperVsLivePanel accountId={chrome.activeAccountId} />
            </section>

            <section id="analytics-learning" className="dashboard-section scroll-mt-24">
              <p className="dashboard-section-title">Trade memory + learning</p>
              <TradeLearningPanel refreshKey={analytics.tradeCount} />
            </section>

            <section className="dashboard-section scroll-mt-24">
              <p className="dashboard-section-title">Performance</p>
              <AnalyticsDashboard analytics={analytics} startingBalance={startingBalance} />
            </section>
          </div>
        )}
      </AppTabShell>
      {chrome.tradingRulesModal}
      <Toaster />
    </>
  )
}
