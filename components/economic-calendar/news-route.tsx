"use client"

import { Toaster } from "@/components/ui/toaster"
import { AccountSettingsModal } from "@/components/dashboard/account-settings-modal"
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome"
import { EconomicNewsWorkspace } from "@/components/economic-calendar/economic-news-workspace"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { useAccountSettingsModal } from "@/hooks/use-account-settings-modal"
import { useDashboardChrome } from "@/hooks/use-dashboard-chrome"
import { useRouter } from "next/navigation"
import { APP_HOME_PATH } from "@/lib/branding"
import { getDashboardHomeHref } from "@/lib/dashboard-nav"

export function NewsRoute() {
  const router = useRouter()
  const chrome = useDashboardChrome({ loginNextPath: "/news" })
  const settings = useAccountSettingsModal(chrome.supabase, chrome.user?.id)

  if (chrome.isLoggingOut) return <SigningOutScreen />
  if (!chrome.isAuthReady) return null

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
        <EconomicNewsWorkspace />
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
