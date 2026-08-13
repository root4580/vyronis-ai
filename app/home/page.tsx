"use client"

import { useRouter } from "next/navigation"
import { Toaster } from "@/components/ui/toaster"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { AppTabShell } from "@/components/shell/app-tab-shell"
import { HqDashboard } from "@/components/dashboard/hq-dashboard"
import { TodaysMissionCard } from "@/components/dashboard/todays-mission-card"
import { RiskGuardBanner } from "@/components/dashboard/risk-guard-banner"
import { useDashboardChrome } from "@/hooks/use-dashboard-chrome"
import { useHomeDashboardData } from "@/hooks/use-home-dashboard-data"

export default function HomePage() {
  const router = useRouter()
  const chrome = useDashboardChrome({ loginNextPath: "/home" })

  const data = useHomeDashboardData({
    supabase: chrome.supabase,
    userId: chrome.user?.id,
    userMetadata: chrome.user?.user_metadata,
    activeAccountId: chrome.activeAccountId,
    legacyAccountId: chrome.legacyTradeAccountId,
  })

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
        activeTab="home"
        profileCard={chrome.profileCard}
        showProfileEmptyHint={chrome.showProfileEmptyHint}
        accountSwitcher={chrome.accountSwitcher}
        onOpenSettings={() => router.push("/settings")}
        onLogout={() => void chrome.handleLogout()}
        isLoggingOut={chrome.isLoggingOut}
        banner={chrome.tradingRulesBanner}
      >
        <section className="dashboard-section">
          <p className="dashboard-section-title">Home</p>
          <p className="max-w-2xl text-sm text-muted-foreground/75">
            Today&apos;s mission, your bias, and where things stand.
          </p>
        </section>

        <TodaysMissionCard settings={data.settingsForm} trades={data.accountTrades} />

        <RiskGuardBanner trades={data.accountTrades} settings={data.settingsForm} />

        {chrome.activeAccount ? (
          <HqDashboard
            trades={data.accountTrades}
            winRate={data.winRate}
            activeAccount={chrome.activeAccount}
            settings={data.settingsForm}
            tradingRulesSnapshot={chrome.tradingRules.snapshot}
            traderFirstName={data.userProfile.first_name}
            onOpenCoach={() => router.push("/council")}
            onOpenWarRoom={() => router.push("/plan")}
            onOpenJournal={() => router.push("/trade")}
            onOpenPlanner={(pair) =>
              router.push(pair ? `/plan?pair=${encodeURIComponent(pair)}` : "/plan")
            }
            onViewTrade={(trade) => router.push(`/trade?trade=${encodeURIComponent(trade.id)}`)}
            onOpenSettings={() => router.push("/settings")}
            mt5Balance={data.userSettings?.mt5_balance ?? null}
            mt5LastPingAt={data.userSettings?.mt5_last_ping_at ?? null}
            mt5LastSyncAt={data.userSettings?.mt5_last_sync_at ?? null}
          />
        ) : null}
      </AppTabShell>
      {chrome.tradingRulesModal}
      <Toaster />
    </>
  )
}
