"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FlaskConical, Upload } from "lucide-react"
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { useDashboardChrome } from "@/hooks/use-dashboard-chrome"
import { useAccountSettingsModal } from "@/hooks/use-account-settings-modal"
import { fetchResearchComparison } from "@/lib/research/api-client"
import type { ResearchComparisonSummary } from "@/lib/research/strategy-comparison"
import { formatStrategyPnL } from "@/lib/strategy-performance"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { Toaster } from "@/components/ui/toaster"

export default function ResearchLabPage() {
  const router = useRouter()
  const chrome = useDashboardChrome({ loginNextPath: "/research-lab" })
  const settings = useAccountSettingsModal(chrome.supabase, chrome.user?.id)

  const [comparison, setComparison] = useState<ResearchComparisonSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!chrome.isAuthReady) return

    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const result = await fetchResearchComparison()
        if (!cancelled) setComparison(result)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load comparison")
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [chrome.isAuthReady])

  if (chrome.isLoggingOut) {
    return <SigningOutScreen />
  }

  if (!chrome.isAuthReady) {
    return null
  }

  return (
    <>
      <DashboardChrome
        activeTab="analytics"
        profileCard={chrome.profileCard}
        showProfileEmptyHint={chrome.showProfileEmptyHint}
        accountSwitcher={chrome.accountSwitcher}
        onOpenSettings={settings.openSettings}
        onLogout={() => void chrome.handleLogout()}
        isLoggingOut={chrome.isLoggingOut}
        onFabClick={() => router.push("/?action=new-trade")}
      >
        <section className="dashboard-section">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="dashboard-section-title mb-1 flex items-center gap-2">
                <FlaskConical className="size-4 text-cyan-glow" />
                MT5 Research Lab
              </p>
              <p className="max-w-2xl text-sm text-muted-foreground/75">
                Demo-only strategy research. Import MT5 CSV history to compare performance — no live
                trading or order execution.
              </p>
            </div>
            <Link
              href="/research-lab/import"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-glow to-cyan-glow/80 px-4 py-2.5 text-sm font-semibold text-background"
            >
              <Upload className="size-4" />
              Import CSV
            </Link>
          </div>
        </section>

        <DashboardInsetPanel className="border-cyan-glow/20 bg-cyan-glow/[0.04] px-4 py-3 text-[12px] text-muted-foreground/80">
          Demo accounts only. Imported trades are isolated from your manual journal and tagged{" "}
          <code className="text-cyan-glow/90">mt5_csv</code>.
        </DashboardInsetPanel>

        {isLoading ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <span className="size-6 animate-spin rounded-full border-2 border-cyan-glow/30 border-t-cyan-glow" />
          </div>
        ) : error ? (
          <DashboardInsetPanel className="border-loss/20 bg-loss/[0.06] px-4 py-3 text-sm text-loss/90">
            {error}
          </DashboardInsetPanel>
        ) : !comparison?.hasData ? (
          <DashboardInsetPanel className="px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground/90">No research imports yet</p>
            <p className="mt-2 text-[12px] text-muted-foreground/75">
              Create a demo strategy and import an MT5 CSV export to start comparing results.
            </p>
            <Link
              href="/research-lab/import"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-glow hover:underline"
            >
              <Upload className="size-4" />
              Import your first CSV
            </Link>
          </DashboardInsetPanel>
        ) : (
          <section className="dashboard-section space-y-3">
            <p className="dashboard-section-title">Strategy Comparison</p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {comparison.strategies.map((strategy) => (
                <DashboardInsetPanel
                  key={strategy.strategyId}
                  className="border-white/[0.06] bg-black/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{strategy.name}</p>
                      <p className="text-[11px] text-muted-foreground/70">
                        {strategy.tradeCount} trades · {strategy.winRate}% WR · avg RR{" "}
                        {strategy.avgRR.toFixed(2)}
                      </p>
                    </div>
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: strategy.color }}
                    />
                  </div>
                  <p
                    className={`mt-3 text-2xl font-semibold tabular-nums ${
                      strategy.totalPnL >= 0 ? "text-profit" : "text-loss"
                    }`}
                  >
                    {formatStrategyPnL(strategy.totalPnL)}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground/75">
                    <div>Max DD: ${strategy.maxDrawdown.toFixed(2)}</div>
                    <div>
                      Best session: {strategy.bestSession?.name || "—"} (
                      {strategy.bestSession ? formatStrategyPnL(strategy.bestSession.pnl) : "—"})
                    </div>
                    <div>
                      Best pair: {strategy.bestPair?.pair || "—"} (
                      {strategy.bestPair ? formatStrategyPnL(strategy.bestPair.pnl) : "—"})
                    </div>
                  </div>
                </DashboardInsetPanel>
              ))}
            </div>
          </section>
        )}
      </DashboardChrome>

      <Toaster />
    </>
  )
}
