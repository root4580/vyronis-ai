"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Toaster } from "@/components/ui/toaster"
import { AccountSettingsModal } from "@/components/dashboard/account-settings-modal"
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome"
import { DailyCloseWorkspace } from "@/components/journal/daily-close-workspace"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import type { DashboardTradeRow } from "@/components/dashboard/trading-components"
import { useAccountSettingsModal } from "@/hooks/use-account-settings-modal"
import { useDashboardChrome } from "@/hooks/use-dashboard-chrome"
import { APP_HOME_PATH } from "@/lib/branding"
import { getDashboardHomeHref } from "@/lib/dashboard-nav"
import {
  DASHBOARD_TRADES_LIMIT,
  DASHBOARD_TRADE_SELECT,
} from "@/lib/trades/dashboard-trade-query"

export function DailyCloseRoute() {
  const router = useRouter()
  const chrome = useDashboardChrome({ loginNextPath: "/journal/close" })
  const settings = useAccountSettingsModal(chrome.supabase, chrome.user?.id)
  const [trades, setTrades] = useState<DashboardTradeRow[]>([])

  useEffect(() => {
    if (!chrome.user?.id || !chrome.activeAccountId) return
    void chrome.supabase
      .from("trades")
      .select(DASHBOARD_TRADE_SELECT)
      .eq("user_id", chrome.user.id)
      .order("created_at", { ascending: false })
      .limit(DASHBOARD_TRADES_LIMIT)
      .then(({ data }: { data: DashboardTradeRow[] | null }) => {
        if (data) setTrades(data)
      })
  }, [chrome.supabase, chrome.user?.id, chrome.activeAccountId])

  if (chrome.isLoggingOut) return <SigningOutScreen />
  if (!chrome.isAuthReady || !chrome.activeAccountId) return null

  return (
    <>
      <DashboardChrome
        activeTab="dashboard"
        profileCard={chrome.profileCard}
        showProfileEmptyHint={chrome.showProfileEmptyHint}
        accountSwitcher={chrome.accountSwitcher}
        onOpenSettings={settings.openSettings}
        onLogout={() => void chrome.handleLogout()}
        isLoggingOut={chrome.isLoggingOut}
        showSignalBell={Boolean(chrome.user)}
        showMobileDock={Boolean(chrome.user)}
        onDockHome={() => router.replace(getDashboardHomeHref())}
        onDockPlanner={() => router.replace("/trade-planner")}
        onDockCoach={() => router.replace(getDashboardHomeHref())}
        onDockLog={() => router.replace(`${APP_HOME_PATH}?action=new-trade`)}
        banner={chrome.tradingRulesBanner}
        mainClassName="dashboard-container px-4 py-5 pb-28 md:px-6 md:py-6 md:pb-24"
      >
        <DailyCloseWorkspace accountId={chrome.activeAccountId} trades={trades} />
      </DashboardChrome>
      {chrome.tradingRulesModal}
      <AccountSettingsModal
        open={settings.isOpen}
        onClose={settings.closeSettings}
        form={settings.form}
        onFormChange={(updates) => settings.setForm((prev) => ({ ...prev, ...updates }))}
        onSubmit={(event) => void settings.saveSettings(event)}
        isSaving={settings.isSaving}
        accountBalance={settings.form.starting_balance}
        totalPnL={0}
      />
      <Toaster />
    </>
  )
}
