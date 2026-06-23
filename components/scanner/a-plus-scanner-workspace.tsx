"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Radar,
  ListChecks,
  Eye,
  Zap,
  ChevronRight,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardInsetPanel,
} from "@/components/dashboard/dashboard-primitives"
import { SetupScoreBadge } from "@/components/dashboard/setup-score-badge"
import { SignalDetailsPanel } from "@/components/scanner/signal-details-panel"
import { getDashboardHomeHref } from "@/lib/dashboard-nav"
import {
  DEFAULT_SELECTED_SIGNAL_ID,
  MOCK_LIVE_SIGNALS,
  MOCK_STRATEGY_RULES,
  MOCK_WATCHLIST,
  type ScannerLiveSignal,
  type ScannerRuleStatus,
} from "@/lib/scanner/mock-data"
import { scannerGradeToSetupClassification } from "@/lib/scanner/scoring"
import { cn } from "@/lib/utils"

function ruleStatusIcon(status: ScannerRuleStatus) {
  if (status === "pass") return <CheckCircle2 className="size-3.5 text-profit" />
  if (status === "warn") return <AlertTriangle className="size-3.5 text-amber-400" />
  return <XCircle className="size-3.5 text-loss" />
}

function biasClass(bias: string): string {
  if (bias === "Bullish") return "text-profit"
  if (bias === "Bearish") return "text-loss"
  return "text-muted-foreground"
}

function signalStatusLabel(signal: ScannerLiveSignal): string {
  if (signal.status === "active") return "Active"
  if (signal.status === "watching") return "Watching"
  return "Expired"
}

function signalStatusClass(status: ScannerLiveSignal["status"]): string {
  if (status === "active") return "bg-profit/15 text-profit"
  if (status === "watching") return "bg-amber-400/15 text-amber-300"
  return "bg-muted-foreground/15 text-muted-foreground"
}

export function APlusScannerWorkspace() {
  const [selectedSignalId, setSelectedSignalId] = useState(DEFAULT_SELECTED_SIGNAL_ID)

  const selectedSignal = useMemo(
    () => MOCK_LIVE_SIGNALS.find((s) => s.id === selectedSignalId) ?? MOCK_LIVE_SIGNALS[0],
    [selectedSignalId],
  )

  const activeCount = MOCK_LIVE_SIGNALS.filter((s) => s.status === "active").length
  const aPlusCount = MOCK_LIVE_SIGNALS.filter((s) => s.grade === "A+").length

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-12">
      <header className="space-y-2">
        <Link
          href={getDashboardHomeHref()}
          className="inline-flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-accent"
        >
          <ArrowLeft className="size-3.5" />
          HQ Dashboard
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-lg font-medium text-text-primary">A+ Scanner</h1>
            <p className="mt-0.5 text-[12px] text-text-muted">
              Precision Flow scoring — HTF alignment, zone, sweep, structure, confirmation, session, R:R.
            </p>
          </div>
          <Badge
            variant="outline"
            className="w-fit border-cyan-glow/25 bg-cyan-glow/[0.06] text-[10px] text-cyan-glow"
          >
            Preview · mock EUR/USD, GBP/CAD, GBP/NZD
          </Badge>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-4">
          <DashboardCard className="glass-card">
            <DashboardCardHeader title="Strategy Rules" icon={ListChecks} />
            <DashboardCardBody className="space-y-2">
              {MOCK_STRATEGY_RULES.map((rule) => (
                <DashboardInsetPanel
                  key={rule.id}
                  className="flex items-start gap-2.5 px-3 py-2.5"
                >
                  <span className="mt-0.5 shrink-0">{ruleStatusIcon(rule.status)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-foreground/90">{rule.label}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/70">
                      {rule.detail}
                    </p>
                  </div>
                </DashboardInsetPanel>
              ))}
            </DashboardCardBody>
          </DashboardCard>

          <DashboardCard className="glass-card">
            <DashboardCardHeader
              title="Pair Watchlist"
              icon={Eye}
              badge={
                <Badge variant="outline" className="text-[10px]">
                  {MOCK_WATCHLIST.length} pairs
                </Badge>
              }
            />
            <DashboardCardBody className="space-y-2">
              {MOCK_WATCHLIST.map((item) => (
                <DashboardInsetPanel
                  key={item.id}
                  className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-foreground/95">{item.pair}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/65">{item.session}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span>
                      W{" "}
                      <span className={cn("font-medium", biasClass(item.weeklyBias))}>
                        {item.weeklyBias}
                      </span>
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span>
                      D{" "}
                      <span className={cn("font-medium", biasClass(item.dailyBias))}>
                        {item.dailyBias}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                        item.aoiReady
                          ? "bg-cyan-glow/10 text-cyan-glow"
                          : "bg-white/[0.04] text-muted-foreground",
                      )}
                    >
                      {item.aoiReady ? "AOI ready" : "AOI pending"}
                    </span>
                  </div>
                </DashboardInsetPanel>
              ))}
            </DashboardCardBody>
          </DashboardCard>
        </div>

        <div className="space-y-4 lg:col-span-8">
          <DashboardCard className="glass-card">
            <DashboardCardHeader
              title="Live Signals"
              icon={Radar}
              badge={
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant="outline"
                    className="border-profit/25 bg-profit/10 text-[10px] text-profit"
                  >
                    {activeCount} active
                  </Badge>
                  {aPlusCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="border-cyan-glow/25 bg-cyan-glow/10 text-[10px] text-cyan-glow"
                    >
                      {aPlusCount} A+
                    </Badge>
                  ) : null}
                </div>
              }
            />
            <DashboardCardBody className="space-y-2">
              {MOCK_LIVE_SIGNALS.map((signal) => {
                const selected = signal.id === selectedSignal?.id
                const classification = scannerGradeToSetupClassification(signal.grade)
                return (
                  <button
                    key={signal.id}
                    type="button"
                    onClick={() => setSelectedSignalId(signal.id)}
                    className={cn(
                      "dashboard-inset-panel flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                      selected
                        ? "border-cyan-glow/30 bg-cyan-glow/[0.06]"
                        : "hover:border-white/[0.12] hover:bg-white/[0.03]",
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-foreground/95">
                          {signal.pair}
                        </span>
                        <span
                          className={cn(
                            "text-[11px] font-bold",
                            signal.direction === "BUY" ? "text-profit" : "text-loss",
                          )}
                        >
                          {signal.direction}
                        </span>
                        <SetupScoreBadge
                          classification={classification}
                          score={signal.score}
                          size="sm"
                          showScore
                        />
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[9px] font-medium",
                            signalStatusClass(signal.status),
                          )}
                        >
                          {signalStatusLabel(signal)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/75">{signal.setup}</p>
                      <p className="text-[10px] text-muted-foreground/55">
                        {signal.session} · {signal.detectedAt} · {signal.confidence}% conf · R:R{" "}
                        {signal.riskReward}
                      </p>
                    </div>
                    <ChevronRight
                      className={cn(
                        "size-4 shrink-0",
                        selected ? "text-cyan-glow" : "text-muted-foreground/40",
                      )}
                    />
                  </button>
                )
              })}
            </DashboardCardBody>
          </DashboardCard>

          <DashboardCard className="glass-card">
            <DashboardCardHeader title="Signal Details" icon={Zap} />
            <DashboardCardBody>
              <SignalDetailsPanel signal={selectedSignal ?? null} />
            </DashboardCardBody>
          </DashboardCard>
        </div>
      </div>
    </div>
  )
}
