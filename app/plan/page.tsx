"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Toaster } from "@/components/ui/toaster"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { AppTabShell } from "@/components/shell/app-tab-shell"
import { WeeklyWarRoom } from "@/components/journal/weekly-war-room"
import { TradePlannerWorkspace } from "@/components/trade-planner/trade-planner-workspace"
import { APlusScannerWorkspace } from "@/components/scanner/a-plus-scanner-workspace"
import { CommandCenterBridge } from "@/components/command-center/command-center-bridge"
import { CommandCenterLauncher } from "@/components/command-center/command-center-launcher"
import { VyronisCommandCenter } from "@/components/command-center/vyronis-command-center"
import { AIContextProvider } from "@/providers/ai-context-provider"
import { useAccountSettingsModal } from "@/hooks/use-account-settings-modal"
import { useDashboardChrome } from "@/hooks/use-dashboard-chrome"
import { fetchUserStartingBalance, fetchUserTradesForAnalytics } from "@/lib/analytics/fetch-trades"
import { computeCurrentAccountBalance } from "@/lib/trade-planner/account-balance"
import { markRitualCoachEngaged } from "@/lib/daily-ritual"
import { APP_HOME_PATH } from "@/lib/branding"

/**
 * Plan tab — consolidates War Room (bias/AOI/watchlist), the Trade Planner
 * calculator, and the A+ Scanner's graded signals into one screen. Strategy
 * Brain's Sunday-plan/AOI panels are intentionally NOT duplicated here since
 * War Room already surfaces the same weekly-plan data; Strategy Brain stays
 * reachable at its old URL until the redesign fully retires it.
 */
export default function PlanPage() {
  const router = useRouter()
  const chrome = useDashboardChrome({ loginNextPath: "/plan" })
  const settings = useAccountSettingsModal(chrome.supabase, chrome.user?.id)
  const openCommandCenterRef = useRef<() => void>(() => {})

  const [startingBalance, setStartingBalance] = useState(settings.form.starting_balance)
  const [totalPnL, setTotalPnL] = useState(0)
  const [skippedBalanceTrades, setSkippedBalanceTrades] = useState(0)
  const [balanceLoaded, setBalanceLoaded] = useState(false)

  const currentAccountBalance = useMemo(
    () => startingBalance + totalPnL,
    [startingBalance, totalPnL],
  )

  useEffect(() => {
    if (!chrome.user?.id) return
    let cancelled = false

    async function loadBalance() {
      const userId = chrome.user!.id
      const [tradesResult, balance] = await Promise.all([
        fetchUserTradesForAnalytics(chrome.supabase, userId, "manual", {
          accountId: chrome.activeAccountId,
          legacyAccountId: chrome.legacyTradeAccountId,
        }),
        fetchUserStartingBalance(chrome.supabase, userId, chrome.activeAccountId),
      ])

      if (cancelled) return

      setStartingBalance(balance)
      const computed = computeCurrentAccountBalance(balance, tradesResult.trades)
      setTotalPnL(computed.totalPnL)
      setSkippedBalanceTrades(computed.skippedTrades)
      setBalanceLoaded(true)
    }

    void loadBalance()
    return () => {
      cancelled = true
    }
  }, [chrome.supabase, chrome.user?.id, chrome.activeAccountId, chrome.legacyTradeAccountId])

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
    <AIContextProvider
      userId={chrome.user?.id}
      maxRiskPerTrade={settings.form.max_risk_per_trade}
      onLogPlannedTrade={(sessionId) => router.replace(`${APP_HOME_PATH}?coach=${sessionId}`)}
    >
      <CommandCenterBridge
        onBindOpen={(open) => {
          openCommandCenterRef.current = open
        }}
        onBindPreTrade={() => {}}
      />
      <AppTabShell
        activeTab="plan"
        profileCard={chrome.profileCard}
        showProfileEmptyHint={chrome.showProfileEmptyHint}
        accountSwitcher={chrome.accountSwitcher}
        onOpenSettings={() => router.push("/settings")}
        onLogout={() => void chrome.handleLogout()}
        isLoggingOut={chrome.isLoggingOut}
        banner={chrome.tradingRulesBanner}
        advisorBar={chrome.user ? <CommandCenterLauncher /> : null}
      >
        <section className="dashboard-section">
          <p className="dashboard-section-title">Plan</p>
          <p className="max-w-2xl text-sm text-muted-foreground/75">
            This week&apos;s bias, your watchlist, the calculator, and setups worth watching.
          </p>
        </section>

        <WeeklyWarRoom
          accountId={chrome.activeAccountId}
          onCoachEngaged={() => {
            if (chrome.user?.id) markRitualCoachEngaged(chrome.user.id)
          }}
        />

        <div className="hq-surface-card p-4">
          <p className="section-label mb-3">Trade calculator</p>
          <TradePlannerWorkspace
            defaultAccountSize={balanceLoaded ? currentAccountBalance : settings.form.starting_balance}
            defaultRiskPercent={settings.form.max_risk_per_trade}
            maxRiskPerTrade={settings.form.max_risk_per_trade}
            accountSizeReady={balanceLoaded}
            skippedBalanceTrades={skippedBalanceTrades}
            canSavePlan={chrome.tradingRules.canSavePlan}
            tradingBlockMessage={chrome.tradingRules.blockMessage}
            onTradingBlocked={() => {
              if (chrome.tradingRules.snapshot?.cooldownRequired) {
                chrome.tradingRules.setCooldownModalOpen(true)
              }
            }}
            onCoachEngaged={() => {
              if (chrome.user?.id) markRitualCoachEngaged(chrome.user.id)
            }}
          />
        </div>

        <div>
          <p className="dashboard-section-title mb-3">Setups worth watching</p>
          <APlusScannerWorkspace />
        </div>
      </AppTabShell>
      {chrome.tradingRulesModal}
      <VyronisCommandCenter />
      <Toaster />
    </AIContextProvider>
  )
}
