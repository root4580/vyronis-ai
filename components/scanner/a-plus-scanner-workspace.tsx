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
import { getDashboardHomeHref } from "@/lib/dashboard-nav"
import {
  DEFAULT_SELECTED_SIGNAL_ID,
  MOCK_LIVE_SIGNALS,
  MOCK_STRATEGY_RULES,
  MOCK_WATCHLIST,
  type ScannerLiveSignal,
  type ScannerRuleStatus,
  type ScannerSignalGrade,
} from "@/lib/scanner/mock-data"
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

function gradeBadgeClass(grade: ScannerSignalGrade): string {
  if (grade === "A+") return "border-cyan-glow/35 bg-cyan-glow/10 text-cyan-glow"
  if (grade === "A") return "border-profit/30 bg-profit/10 text-profit"
  return "border-white/10 bg-white/[0.04] text-muted-foreground"
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
              Precision Flow setups across your watchlist — mock data preview.
            </p>
          </div>
          <Badge
            variant="outline"
            className="w-fit border-cyan-glow/25 bg-cyan-glow/[0.06] text-[10px] text-cyan-glow"
          >
            Preview · no live feed yet
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
                      W <span className={cn("font-medium", biasClass(item.weeklyBias))}>{item.weeklyBias}</span>
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span>
                      D <span className={cn("font-medium", biasClass(item.dailyBias))}>{item.dailyBias}</span>
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
                <Badge variant="outline" className="border-profit/25 bg-profit/10 text-[10px] text-profit">
                  {activeCount} active
                </Badge>
              }
            />
            <DashboardCardBody className="space-y-2">
              {MOCK_LIVE_SIGNALS.map((signal) => {
                const selected = signal.id === selectedSignal?.id
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
                        <span
                          className={cn(
                            "rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase",
                            gradeBadgeClass(signal.grade),
                          )}
                        >
                          {signal.grade}
                        </span>
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
                        {signal.session} · {signal.detectedAt} · R:R {signal.riskReward}
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
            <DashboardCardHeader
              title="Signal Details"
              icon={Zap}
              badge={
                selectedSignal ? (
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase",
                      gradeBadgeClass(selectedSignal.grade),
                    )}
                  >
                    {selectedSignal.grade}
                  </span>
                ) : null
              }
            />
            <DashboardCardBody>
              {selectedSignal ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground/95">
                      {selectedSignal.pair}{" "}
                      <span
                        className={cn(
                          selectedSignal.direction === "BUY" ? "text-profit" : "text-loss",
                        )}
                      >
                        {selectedSignal.direction}
                      </span>
                    </h2>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-medium",
                        signalStatusClass(selectedSignal.status),
                      )}
                    >
                      {signalStatusLabel(selectedSignal)}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground/80">{selectedSignal.setup}</p>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: "Entry", value: selectedSignal.entry.toFixed(4) },
                      { label: "Stop loss", value: selectedSignal.stopLoss.toFixed(4) },
                      { label: "Take profit", value: selectedSignal.takeProfit.toFixed(4) },
                      { label: "R:R", value: selectedSignal.riskReward },
                    ].map((metric) => (
                      <DashboardInsetPanel key={metric.label} className="px-3 py-2.5">
                        <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60">
                          {metric.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-foreground/90">
                          {metric.value}
                        </p>
                      </DashboardInsetPanel>
                    ))}
                  </div>

                  <DashboardInsetPanel className="px-3 py-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/65">
                      Confluences
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {selectedSignal.confluences.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-[11px] text-foreground/85"
                        >
                          <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-cyan-glow/80" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </DashboardInsetPanel>

                  <DashboardInsetPanel className="px-3 py-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/65">
                      Coach notes
                    </p>
                    <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground/80">
                      {selectedSignal.notes}
                    </p>
                  </DashboardInsetPanel>
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground/70">
                  Select a signal from the list above.
                </p>
              )}
            </DashboardCardBody>
          </DashboardCard>
        </div>
      </div>
    </div>
  )
}
