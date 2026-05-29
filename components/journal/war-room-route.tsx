"use client"

import { Toaster } from "@/components/ui/toaster"
import { AccountSettingsModal } from "@/components/dashboard/account-settings-modal"
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome"
import { WeeklyWarRoom } from "@/components/journal/weekly-war-room"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { useAccountSettingsModal } from "@/hooks/use-account-settings-modal"
import { useDashboardChrome } from "@/hooks/use-dashboard-chrome"

export function WarRoomRoute() {
  const chrome = useDashboardChrome({ loginNextPath: "/war-room" })
  const settings = useAccountSettingsModal(chrome.supabase, chrome.user?.id)

  if (chrome.isLoggingOut) return <SigningOutScreen />
  if (!chrome.isAuthReady) return null

  return (
    <>
      <DashboardChrome
        activeTab="journal"
        profileCard={chrome.profileCard}
        showProfileEmptyHint={chrome.showProfileEmptyHint}
        onOpenSettings={settings.openSettings}
        onLogout={() => void chrome.handleLogout()}
        isLoggingOut={chrome.isLoggingOut}
        mainClassName="dashboard-container px-4 py-5 pb-28 md:px-6 md:py-6 md:pb-24"
      >
        <WeeklyWarRoom />
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
