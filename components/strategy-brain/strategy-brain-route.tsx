"use client"

import { Toaster } from "@/components/ui/toaster"
import { AccountSettingsModal } from "@/components/dashboard/account-settings-modal"
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome"
import { StrategyBrainPageClient } from "@/components/strategy-brain/strategy-brain-page"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { useAccountSettingsModal } from "@/hooks/use-account-settings-modal"
import { useDashboardChrome } from "@/hooks/use-dashboard-chrome"
import { useRouter } from "next/navigation"

export function StrategyBrainRoute() {
  const router = useRouter()
  const chrome = useDashboardChrome({ loginNextPath: "/strategy-brain" })
  const settings = useAccountSettingsModal(chrome.supabase, chrome.user?.id)

  if (chrome.isLoggingOut) {
    return <SigningOutScreen />
  }

  if (!chrome.isAuthReady) {
    return null
  }

  return (
    <>
      <DashboardChrome
        activeTab="strategies"
        profileCard={chrome.profileCard}
        showProfileEmptyHint={chrome.showProfileEmptyHint}
        onOpenSettings={settings.openSettings}
        onLogout={() => void chrome.handleLogout()}
        isLoggingOut={chrome.isLoggingOut}
        showFab
        onFabClick={() => router.push("/?action=new-trade")}
        mainClassName="dashboard-container px-4 py-5 pb-28 md:px-6 md:py-6 md:pb-24"
      >
        <StrategyBrainPageClient />
      </DashboardChrome>

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
