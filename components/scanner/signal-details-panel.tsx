"use client"

import { CheckCircle2, AlertTriangle } from "lucide-react"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { APlusScore } from "@/components/scanner/a-plus-score"
import {
  SetupScoreBadge,
  getSetupScoreGlowClass,
} from "@/components/dashboard/setup-score-badge"
import type { ScannerLiveSignal } from "@/lib/scanner/mock-data"
import { scannerGradeToSetupClassification } from "@/lib/scanner/scoring"
import { cn } from "@/lib/utils"

type SignalDetailsPanelProps = {
  signal: ScannerLiveSignal | null
}

function biasClass(bias: string): string {
  if (bias === "Bullish") return "text-profit"
  if (bias === "Bearish") return "text-loss"
  return "text-muted-foreground"
}

function signalStatusLabel(status: ScannerLiveSignal["status"]): string {
  if (status === "active") return "Active"
  if (status === "watching") return "Watching"
  return "Expired"
}

function signalStatusClass(status: ScannerLiveSignal["status"]): string {
  if (status === "active") return "bg-profit/15 text-profit"
  if (status === "watching") return "bg-amber-400/15 text-amber-300"
  return "bg-muted-foreground/15 text-muted-foreground"
}

function sweepTone(status: ScannerLiveSignal["liquiditySweepStatus"]): string {
  if (status === "Confirmed") return "text-profit"
  if (status === "Pending") return "text-amber-300"
  return "text-muted-foreground"
}

function structureTone(status: ScannerLiveSignal["chochBosStatus"]): string {
  if (status === "CHoCH" || status === "BOS") return "text-cyan-glow"
  if (status === "Pending") return "text-amber-300"
  return "text-muted-foreground"
}

function DetailRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-2 last:border-0">
      <span className="text-[10px] text-muted-foreground/65">{label}</span>
      <span className={cn("text-[11px] font-medium text-foreground/90", valueClass)}>{value}</span>
    </div>
  )
}

export function SignalDetailsPanel({ signal }: SignalDetailsPanelProps) {
  if (!signal) {
    return (
      <p className="text-[12px] text-muted-foreground/70">Select a signal from the list above.</p>
    )
  }

  const classification = scannerGradeToSetupClassification(signal.grade)

  const detailRows: { label: string; value: string; valueClass?: string }[] = [
    { label: "Pair", value: signal.pair },
    {
      label: "Direction",
      value: signal.direction,
      valueClass: signal.direction === "BUY" ? "text-profit" : "text-loss",
    },
    { label: "Daily bias", value: signal.dailyBias, valueClass: biasClass(signal.dailyBias) },
    { label: "H4 bias", value: signal.h4Bias, valueClass: biasClass(signal.h4Bias) },
    { label: "Zone type", value: signal.zoneType },
    {
      label: "Liquidity sweep",
      value: signal.liquiditySweepStatus,
      valueClass: sweepTone(signal.liquiditySweepStatus),
    },
    {
      label: "CHoCH / BOS",
      value: signal.chochBosStatus,
      valueClass: structureTone(signal.chochBosStatus),
    },
    { label: "Confirmation", value: signal.confirmationType },
    { label: "R:R ratio", value: signal.riskReward, valueClass: "text-cyan-glow tabular-nums" },
  ]

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-white/[0.08] px-3 py-3",
          "bg-gradient-to-br from-black/40 via-surface-card to-black/30",
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b opacity-50",
            getSetupScoreGlowClass(classification),
          )}
        />
        <div className="relative flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-foreground/95">{signal.pair}</h2>
          <span
            className={cn(
              "text-[12px] font-bold",
              signal.direction === "BUY" ? "text-profit" : "text-loss",
            )}
          >
            {signal.direction}
          </span>
          <SetupScoreBadge classification={classification} score={signal.score} size="md" showScore />
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-medium",
              signalStatusClass(signal.status),
            )}
          >
            {signalStatusLabel(signal.status)}
          </span>
          <span className="ml-auto text-[10px] tabular-nums text-cyan-glow">
            {signal.confidence}% confidence
          </span>
        </div>
        <p className="relative mt-1.5 text-[12px] text-muted-foreground/80">{signal.setup}</p>
      </div>

      <APlusScore scoring={signal.scoring} confidence={signal.confidence} compact />

      <DashboardInsetPanel className="px-3 py-1">
        <p className="px-0 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/65">
          Setup breakdown
        </p>
        {detailRows.map((row) => (
          <DetailRow key={row.label} {...row} />
        ))}
      </DashboardInsetPanel>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Entry", value: signal.entry.toFixed(4) },
          { label: "Stop loss", value: signal.stopLoss.toFixed(4) },
          { label: "Take profit", value: signal.takeProfit.toFixed(4) },
          { label: "Session", value: signal.session },
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

      {signal.scoring.strengths.length > 0 && (
        <DashboardInsetPanel className="px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-profit/80">
            Strengths
          </p>
          <ul className="mt-2 space-y-1.5">
            {signal.scoring.strengths.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[11px] text-foreground/85">
                <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-profit" />
                {item}
              </li>
            ))}
          </ul>
        </DashboardInsetPanel>
      )}

      {signal.scoring.warnings.length > 0 && (
        <DashboardInsetPanel className="px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-amber-300/90">
            Gaps / warnings
          </p>
          <ul className="mt-2 space-y-1.5">
            {signal.scoring.warnings.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[11px] text-muted-foreground/85">
                <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-400" />
                {item}
              </li>
            ))}
          </ul>
        </DashboardInsetPanel>
      )}

      <DashboardInsetPanel className="px-3 py-2.5">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/65">
          Coach notes
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground/80">{signal.notes}</p>
      </DashboardInsetPanel>
    </div>
  )
}
