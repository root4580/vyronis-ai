"use client"

import { useMemo } from "react"
import { AlertTriangle, Settings, Wallet } from "lucide-react"
import type { DashboardTradeRow } from "@/components/dashboard/trading-components"
import { formatAccountMoney } from "@/lib/accounts/profit-target"
import { getAccountAccentStyles } from "@/lib/accounts/account-theme"
import type { TradingAccountRecord } from "@/lib/accounts/types"
import {
  evaluateAccountStatus,
  getPropFirmStatusEmoji,
  type PropFirmRuleStatus,
} from "@/lib/account-status"
import { DEFAULT_USER_SETTINGS, type UserSettingsForm } from "@/lib/user-settings"
import { cn } from "@/lib/utils"

type AccountStatusCardProps = {
  trades: DashboardTradeRow[]
  account: TradingAccountRecord
  settings?: UserSettingsForm | null
  onOpenSettings?: () => void
  className?: string
}

const STATUS_STYLES: Record<
  PropFirmRuleStatus,
  { border: string; bg: string; text: string }
> = {
  safe: {
    border: "border-profit/25",
    bg: "bg-profit/[0.08]",
    text: "text-profit",
  },
  caution: {
    border: "border-warning/30",
    bg: "bg-warning/[0.08]",
    text: "text-warning-muted/95",
  },
  danger: {
    border: "border-loss/35",
    bg: "bg-loss/[0.08]",
    text: "text-loss",
  },
  stop: {
    border: "border-loss/45",
    bg: "bg-loss/[0.12]",
    text: "text-loss",
  },
}

function LimitRow({
  label,
  usedLabel,
  percent,
  tone,
}: {
  label: string
  usedLabel: string
  percent: number
  tone: "neutral" | "caution" | "danger" | "stop"
}) {
  const clamped = Math.min(100, Math.max(0, percent))
  const barClass =
    tone === "stop" || tone === "danger"
      ? "bg-loss"
      : tone === "caution"
        ? "bg-warning"
        : "bg-cyan-glow/80"

  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-[10px]">
        <span className="text-text-muted">{label}</span>
        <span className="tabular-nums text-text-secondary">{usedLabel}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-sm bg-white/[0.06]">
        <div className={cn("h-full transition-all", barClass)} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}

function resolveLimitTone(percent: number): "neutral" | "caution" | "danger" | "stop" {
  if (percent >= 100) return "stop"
  if (percent >= 90) return "danger"
  if (percent >= 80) return "caution"
  return "neutral"
}

export function AccountStatusCard({
  trades,
  account,
  settings,
  onOpenSettings,
  className,
}: AccountStatusCardProps) {
  const status = useMemo(
    () =>
      evaluateAccountStatus({
        trades,
        account,
        settings,
      }),
    [trades, account, settings],
  )

  const styles = STATUS_STYLES[status.ruleStatus]
  const money = (value: number) => formatAccountMoney(value, status.currency)
  const accent = getAccountAccentStyles(account)

  return (
    <section aria-label="Account status" className={cn("hq-surface-card flex flex-col p-3.5", className)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border",
              accent.border,
              accent.bg,
            )}
          >
            <Wallet className={cn("size-3.5", accent.text)} />
          </div>
          <div className="min-w-0">
            <p className="section-label">Account status</p>
            <p className="truncate text-[12px] font-medium text-text-primary">{status.accountName}</p>
          </div>
        </div>
        {onOpenSettings ? (
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] border border-white/[0.08] px-2 py-1 text-[10px] text-text-muted hover:text-text-primary"
          >
            <Settings className="size-3" />
            Edit
          </button>
        ) : null}
      </div>

      {status.hasLossStreak ? (
        <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-sm)] border border-warning/25 bg-warning/[0.08] px-2.5 py-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning-muted/90" />
          <p className="text-[11px] leading-relaxed text-warning-muted/95">
            <span className="font-medium">Three losses in a row this week.</span> Step back before the
            next live entry.
          </p>
        </div>
      ) : null}

      <div
        className={cn(
          "mb-3 rounded-[var(--radius-sm)] border px-2.5 py-2",
          styles.border,
          styles.bg,
        )}
      >
        <p className={cn("text-[11px] font-semibold tracking-wide", styles.text)}>
          {getPropFirmStatusEmoji(status.ruleStatus)} {status.ruleLabel} — {status.ruleMessage}
        </p>
      </div>

      <div className="mb-3 rounded-[var(--radius-sm)] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-[0.1em] text-text-muted">Balance snapshot</p>
        <p className="mt-1.5 text-[15px] font-semibold tabular-nums leading-tight text-text-primary sm:text-[17px]">
          {money(status.accountBalance)}
          <span className="mx-1.5 text-[13px] font-normal text-text-muted">/</span>
          <span className="text-[13px] font-medium text-profit sm:text-[15px]">
            Target {money(status.targetBalance)}
          </span>
        </p>
        <p className="mt-1 text-[10px] text-text-muted">
          Drawdown floor {money(status.minBalance)} · Starting {money(status.startingBalance)} (locked)
        </p>
      </div>

      <div className="space-y-2 text-[11px] sm:hidden">
        <div className="flex justify-between gap-2">
          <span className="text-text-muted">Still needed</span>
          <span className="font-medium tabular-nums text-text-primary">
            {status.targetReached ? "Goal hit" : money(status.amountToTarget)}
          </span>
        </div>
      </div>

      <div className="hidden space-y-2 text-[11px] sm:block">
        <div className="flex justify-between gap-2">
          <span className="text-text-muted">💰 Current</span>
          <span
            className={cn(
              "font-medium tabular-nums",
              status.accountBalance >= status.startingBalance ? "text-profit" : "text-loss",
            )}
          >
            {money(status.accountBalance)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-text-muted">Starting</span>
          <span className="font-medium tabular-nums text-text-primary">{money(status.startingBalance)}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[10px]">
          <span className="text-text-muted">
            📊 Progress ({status.profitGoalPercent}% profit goal)
          </span>
          <span className="tabular-nums text-text-secondary">
            {status.targetReached ? "Goal hit" : `${status.targetProgressPercent.toFixed(0)}%`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-sm bg-white/[0.06]">
          <div
            className="h-full bg-profit transition-all"
            style={{ width: `${Math.min(100, status.targetProgressPercent)}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-text-muted">
          {status.targetReached
            ? `${status.profitGoalPercent}% profit goal reached — target ${money(status.targetBalance)}.`
            : `${money(status.amountToTarget)} to reach ${money(status.targetBalance)} (${status.profitGoalPercent}% on ${money(status.startingBalance)})`}
        </p>
      </div>

      <div className="mt-3 space-y-2.5 border-t border-[var(--border-subtle)] pt-3">
        <LimitRow
          label="Max drawdown"
          usedLabel={`${status.drawdownPercent.toFixed(1)}% / ${status.maxDrawdownPercent}% · floor ${money(status.minBalance)}`}
          percent={status.limitUsages.drawdown}
          tone={resolveLimitTone(status.limitUsages.drawdown)}
        />
        <LimitRow
          label="Daily loss limit"
          usedLabel={`${status.dailyLossPercent.toFixed(1)}% / ${status.dailyLossLimitPercent}%`}
          percent={status.limitUsages.dailyLoss}
          tone={resolveLimitTone(status.limitUsages.dailyLoss)}
        />
        <LimitRow
          label="Weekly loss limit"
          usedLabel={`${status.weeklyLossPercent.toFixed(1)}% / ${status.weeklyLossLimitPercent}%`}
          percent={status.limitUsages.weeklyLoss}
          tone={resolveLimitTone(status.limitUsages.weeklyLoss)}
        />
        <LimitRow
          label="Trades this week"
          usedLabel={`${status.tradesThisWeek} / ${status.maxTradesPerWeek}`}
          percent={status.limitUsages.tradesThisWeek}
          tone={resolveLimitTone(status.limitUsages.tradesThisWeek)}
        />
      </div>

      <p className="mt-auto pt-2.5 text-[10px] leading-relaxed text-text-muted/70">
        Balance from logged trades. Account size stays at your starting balance.
      </p>
    </section>
  )
}
