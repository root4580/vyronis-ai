"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Toaster } from "@/components/ui/toaster"
import { AccountSettingsModal } from "@/components/dashboard/account-settings-modal"
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome"
import { TradePlannerWorkspace } from "@/components/trade-planner/trade-planner-workspace"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { CommandCenterBridge } from "@/components/command-center/command-center-bridge"
import { CommandCenterLauncher } from "@/components/command-center/command-center-launcher"
import { VyronisCommandCenter } from "@/components/command-center/vyronis-command-center"
import { useAccountSettingsModal } from "@/hooks/use-account-settings-modal"
import { useDashboardChrome } from "@/hooks/use-dashboard-chrome"
import { useRouter } from "next/navigation"
import { APP_HOME_PATH } from "@/lib/branding"
import { getDashboardHomeHref } from "@/lib/dashboard-nav"
import {
  fetchUserStartingBalance,
  fetchUserTradesForAnalytics,
} from "@/lib/analytics/fetch-trades"
import { computeCurrentAccountBalance } from "@/lib/trade-planner/account-balance"
import { markRitualCoachEngaged } from "@/lib/daily-ritual"
import { AIContextProvider } from "@/providers/ai-context-provider"

export function TradePlannerRoute() {
  const router = useRouter()
  const chrome = useDashboardChrome({ loginNextPath: "/trade-planner" })
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
        fetchUserTradesForAnalytics(chrome.supabase, userId),
        fetchUserStartingBalance(chrome.supabase, userId),
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
  }, [chrome.supabase, chrome.user?.id])

  if (chrome.isLoggingOut) return <SigningOutScreen />
  if (!chrome.isAuthReady) return null

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
      <DashboardChrome
        activeTab="dashboard"
        profileCard={chrome.profileCard}
        showProfileEmptyHint={chrome.showProfileEmptyHint}
        onOpenSettings={settings.openSettings}
        onLogout={() => void chrome.handleLogout()}
        isLoggingOut={chrome.isLoggingOut}
        showSignalBell={Boolean(chrome.user)}
        showMobileDock={Boolean(chrome.user)}
        aiLauncher={chrome.user ? <CommandCenterLauncher /> : null}
        dockHighlight="planner"
        onDockHome={() => router.replace(getDashboardHomeHref())}
        onDockPlanner={() => router.replace("/trade-planner")}
        onDockCoach={() => {
          openCommandCenterRef.current()
          if (chrome.user?.id) markRitualCoachEngaged(chrome.user.id)
        }}
        onDockLog={() => router.replace(`${APP_HOME_PATH}?action=new-trade`)}
        mainClassName="dashboard-container pb-28 md:pb-24"
      >
        <div className="planner-content space-y-5">
          <div>
            <h1 className="text-base font-medium text-text-primary">Trade Planner</h1>
            <p className="mt-0.5 text-[12px] text-text-muted">
              Plan entry, stop, target, risk, and lot size before you execute.
            </p>
          </div>
          <TradePlannerWorkspace
            defaultAccountSize={balanceLoaded ? currentAccountBalance : settings.form.starting_balance}
            defaultRiskPercent={settings.form.max_risk_per_trade}
            maxRiskPerTrade={settings.form.max_risk_per_trade}
            accountSizeReady={balanceLoaded}
            skippedBalanceTrades={skippedBalanceTrades}
            onCoachEngaged={() => {
              if (chrome.user?.id) markRitualCoachEngaged(chrome.user.id)
            }}
          />
        </div>
      </DashboardChrome>
      <AccountSettingsModal
        open={settings.isOpen}
        onClose={settings.closeSettings}
        form={settings.form}
        onFormChange={(updates) => settings.setForm((prev) => ({ ...prev, ...updates }))}
        onSubmit={(event) => void settings.saveSettings(event)}
        isSaving={settings.isSaving}
        accountBalance={currentAccountBalance}
        totalPnL={totalPnL}
      />
      <VyronisCommandCenter />
      <Toaster />
    </AIContextProvider>
  )
}
