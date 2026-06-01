"use client"

import { useEffect, useRef, useState } from "react"
import { Toaster } from "@/components/ui/toaster"
import { AccountSettingsModal } from "@/components/dashboard/account-settings-modal"
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome"
import { WeeklyWarRoom } from "@/components/journal/weekly-war-room"
import { WarRoomCoachDeepLink } from "@/components/journal/war-room-coach-deep-link"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { CommandCenterBridge } from "@/components/command-center/command-center-bridge"
import { CommandCenterLauncher } from "@/components/command-center/command-center-launcher"
import { VyronisCommandCenter } from "@/components/command-center/vyronis-command-center"
import { useAccountSettingsModal } from "@/hooks/use-account-settings-modal"
import { useDashboardChrome } from "@/hooks/use-dashboard-chrome"
import { useRouter } from "next/navigation"
import { APP_HOME_PATH } from "@/lib/branding"
import { getDashboardHomeHref } from "@/lib/dashboard-nav"
import { markRitualCoachEngaged } from "@/lib/daily-ritual"
import { AIContextProvider } from "@/providers/ai-context-provider"
import type { OpenWarRoomPreTradeCoach } from "@/lib/paper-trades/war-room-coach-flow"

export function WarRoomRoute() {
  const router = useRouter()
  const chrome = useDashboardChrome({ loginNextPath: "/war-room" })
  const settings = useAccountSettingsModal(chrome.supabase, chrome.user?.id)
  const openCommandCenterRef = useRef<() => void>(() => {})
  const openPreTradeCoachRef = useRef<OpenWarRoomPreTradeCoach | null>(null)
  const [coachReady, setCoachReady] = useState(false)

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
        onBindPreTrade={(openPreTrade) => {
          openPreTradeCoachRef.current = openPreTrade
          setCoachReady(true)
        }}
      />
      {coachReady ? (
        <WarRoomCoachDeepLink userId={chrome.user?.id} openPreTradeCoachRef={openPreTradeCoachRef} />
      ) : null}
      <DashboardChrome
        activeTab="journal"
        profileCard={chrome.profileCard}
        showProfileEmptyHint={chrome.showProfileEmptyHint}
        accountSwitcher={chrome.accountSwitcher}
        onOpenSettings={settings.openSettings}
        onLogout={() => void chrome.handleLogout()}
        isLoggingOut={chrome.isLoggingOut}
        showSignalBell={Boolean(chrome.user)}
        showMobileDock={Boolean(chrome.user)}
        aiLauncher={chrome.user ? <CommandCenterLauncher /> : null}
        onDockHome={() => router.replace(getDashboardHomeHref())}
        onDockPlanner={() => router.replace("/trade-planner")}
        onDockCoach={() => {
          openCommandCenterRef.current()
          if (chrome.user?.id) markRitualCoachEngaged(chrome.user.id)
        }}
        onDockLog={() => router.replace(`${APP_HOME_PATH}?action=new-trade`)}
        banner={chrome.tradingRulesBanner}
        mainClassName="dashboard-container px-4 py-5 pb-28 md:px-6 md:py-6 md:pb-24"
      >
        <WeeklyWarRoom
          accountId={chrome.activeAccountId}
          onCoachEngaged={() => {
            if (chrome.user?.id) markRitualCoachEngaged(chrome.user.id)
          }}
        />
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
      <VyronisCommandCenter />
      <Toaster />
    </AIContextProvider>
  )
}
