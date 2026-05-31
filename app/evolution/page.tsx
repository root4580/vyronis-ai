"use client"

import { useEffect, useState } from "react"
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome"
import { EvolutionDashboard } from "@/components/trading-os/evolution-dashboard"
import { ReplaySimulatorPanel } from "@/components/trading-os/replay-simulator-panel"
import { AdaptiveCognitionPanel } from "@/components/adaptive-cognition/adaptive-cognition-panel"
import { LifeContextForm } from "@/components/adaptive-cognition/life-context-form"
import type { AdaptiveCognitionSnapshot } from "@/lib/adaptive-cognition/types"
import { EvolutionRoadmapPanel } from "@/components/vyronis-core/evolution-roadmap-panel"
import type { VyronisCoreSnapshot } from "@/lib/vyronis-core/types"
import { DashboardOverviewSkeleton } from "@/components/dashboard/dashboard-skeletons"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { useDashboardChrome } from "@/hooks/use-dashboard-chrome"
import { useAccountSettingsModal } from "@/hooks/use-account-settings-modal"
import { AccountSettingsModal } from "@/components/dashboard/account-settings-modal"
import { Toaster } from "@/components/ui/toaster"
import type { TradingOsSnapshot } from "@/lib/trading-os/types"

export default function EvolutionPage() {
  const chrome = useDashboardChrome({ loginNextPath: "/evolution" })
  const settings = useAccountSettingsModal(chrome.supabase, chrome.user?.id)
  const [tradingOs, setTradingOs] = useState<TradingOsSnapshot | null>(null)
  const [adaptive, setAdaptive] = useState<AdaptiveCognitionSnapshot | null>(null)
  const [vyronisCore, setVyronisCore] = useState<VyronisCoreSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!chrome.user?.id) return
    let cancelled = false
    void (async () => {
      try {
        const [osRes, acRes, coreRes] = await Promise.all([
          fetch("/api/intelligence/trading-os"),
          fetch("/api/intelligence/adaptive-cognition"),
          fetch("/api/intelligence/vyronis-core"),
        ])
        if (!osRes.ok) throw new Error("Failed to load")
        const osData = (await osRes.json()) as { tradingOs: TradingOsSnapshot }
        const acData = acRes.ok
          ? ((await acRes.json()) as { adaptiveCognition: AdaptiveCognitionSnapshot })
          : null
        const coreData = coreRes.ok
          ? ((await coreRes.json()) as { vyronisCore: VyronisCoreSnapshot })
          : null
        if (!cancelled) {
          setTradingOs(osData.tradingOs)
          setAdaptive(acData?.adaptiveCognition ?? null)
          setVyronisCore(coreData?.vyronisCore ?? null)
        }
      } catch {
        if (!cancelled) setTradingOs(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chrome.user?.id, refreshKey])

  if (chrome.isLoggingOut) return <SigningOutScreen />

  if (!chrome.isAuthReady) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <div className="border-b border-white/[0.06] bg-black/40 px-4 py-4 md:px-6">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <div className="size-9 animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="h-4 w-24 animate-pulse rounded bg-white/[0.06]" />
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 py-8">
          <DashboardOverviewSkeleton />
        </div>
      </div>
    )
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
      >
        <div className="mx-auto max-w-5xl px-4 py-8">
          {loading ? (
            <p className="text-sm text-muted-foreground/75">Loading evolution intelligence…</p>
          ) : (
            <>
              <EvolutionRoadmapPanel vyronisCore={vyronisCore} />
              <div className="mt-8">
                <LifeContextForm onSaved={() => setRefreshKey((k) => k + 1)} />
              </div>
              <div className="mt-8">
                <AdaptiveCognitionPanel adaptive={adaptive} />
              </div>
              <div className="mt-8">
                <EvolutionDashboard tradingOs={tradingOs} />
              </div>
              {tradingOs?.replay ? (
                <div className="mt-8">
                  <ReplaySimulatorPanel
                    tradeId={tradingOs.replay.tradeId}
                    scenarios={tradingOs.replay.scenarios}
                    primaryLesson={tradingOs.replay.primaryLesson}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </DashboardChrome>

      <AccountSettingsModal
        open={settings.isOpen}
        onClose={settings.closeSettings}
        form={settings.form}
        onFormChange={(updates) => settings.setForm((prev) => ({ ...prev, ...updates }))}
        onSubmit={(event) => void settings.saveSettings(event)}
        isSaving={settings.isSaving}
        accountBalance={0}
        totalPnL={0}
      />
      <Toaster />
    </>
  )
}
