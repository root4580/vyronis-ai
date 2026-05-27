"use client"

import { Save, Settings, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { PROP_FIRM_SIZES, type UserSettingsForm } from "@/lib/user-settings"

type AccountSettingsModalProps = {
  open: boolean
  onClose: () => void
  form: UserSettingsForm
  onFormChange: (updates: Partial<UserSettingsForm>) => void
  onSubmit: (e: React.FormEvent) => void
  isSaving: boolean
  accountBalance: number
  totalPnL: number
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground/80">
      {children}
    </Label>
  )
}

export function AccountSettingsModal({
  open,
  onClose,
  form,
  onFormChange,
  onSubmit,
  isSaving,
  accountBalance,
  totalPnL,
}: AccountSettingsModalProps) {
  if (!open) return null

  const roi = form.starting_balance > 0 ? (totalPnL / form.starting_balance) * 100 : 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="add-trade-backdrop absolute inset-0" onClick={onClose} aria-hidden />

      <div className="add-trade-modal glass-card relative mx-0 flex max-h-[94vh] w-full flex-col overflow-hidden sm:mx-4 sm:max-h-[90vh] sm:max-w-xl">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-glow/[0.07] via-transparent to-profit/[0.05]" />

        <div className="relative shrink-0 border-b border-white/[0.06] px-4 py-4 md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl border border-cyan-glow/25 bg-cyan-glow/[0.1] shadow-[0_0_20px_rgba(34,211,238,0.12)]">
                <Settings className="size-4 text-cyan-glow" />
              </div>
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight text-foreground">Account Settings</h2>
                <p className="text-[11px] text-muted-foreground/70">Configure balance, risk limits, and prop targets</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border border-transparent p-2 transition-colors hover:border-white/[0.06] hover:bg-white/[0.04]"
            >
              <X className="size-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="relative flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
            <section className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">Account</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Starting Balance ($)</FieldLabel>
                  <Input
                    type="number"
                    step="100"
                    min="0"
                    value={form.starting_balance}
                    onChange={(e) =>
                      onFormChange({ starting_balance: parseFloat(e.target.value) || 0 })
                    }
                    className="add-trade-input h-10 tabular-nums"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Prop Firm / Account Type</FieldLabel>
                  <Select
                    value={form.prop_firm_size}
                    onValueChange={(value) => onFormChange({ prop_firm_size: value })}
                  >
                    <SelectTrigger className="add-trade-input h-10">
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-white/[0.08]">
                      {PROP_FIRM_SIZES.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">Risk Limits</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Daily Loss Limit (%)</FieldLabel>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={form.daily_drawdown_limit}
                    onChange={(e) =>
                      onFormChange({ daily_drawdown_limit: parseFloat(e.target.value) || 0 })
                    }
                    className="add-trade-input h-10 tabular-nums"
                  />
                  <p className="text-[10px] text-muted-foreground/70">Max daily loss before stopping</p>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Max Risk Per Trade (%)</FieldLabel>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={form.max_risk_per_trade}
                    onChange={(e) =>
                      onFormChange({ max_risk_per_trade: parseFloat(e.target.value) || 0 })
                    }
                    className="add-trade-input h-10 tabular-nums"
                  />
                  <p className="text-[10px] text-muted-foreground/70">Used for trade risk alerts</p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <FieldLabel>Max Trades Per Day</FieldLabel>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    max="50"
                    value={form.max_trades_per_day}
                    onChange={(e) =>
                      onFormChange({ max_trades_per_day: parseInt(e.target.value, 10) || 1 })
                    }
                    className="add-trade-input h-10 tabular-nums"
                  />
                  <p className="text-[10px] text-muted-foreground/70">Daily rules checklist uses this limit</p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">Targets</p>
              <div className="space-y-2">
                <FieldLabel>Profit Target (%)</FieldLabel>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={form.profit_target}
                  onChange={(e) =>
                    onFormChange({ profit_target: parseFloat(e.target.value) || 0 })
                  }
                  className="add-trade-input h-10 tabular-nums"
                />
              </div>
            </section>

            <DashboardInsetPanel className="glass border-cyan-glow/15 bg-cyan-glow/[0.04]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/80">
                Live Account Status
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground/75">Starting</span>
                  <span className="font-medium tabular-nums">${form.starting_balance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground/75">Current</span>
                  <span
                    className={`font-medium tabular-nums ${
                      accountBalance >= form.starting_balance ? "text-profit" : "text-loss"
                    }`}
                  >
                    ${accountBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground/75">Total P&L</span>
                  <span className={`font-medium tabular-nums ${totalPnL >= 0 ? "text-profit" : "text-loss"}`}>
                    {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground/75">ROI</span>
                  <span className={`font-medium tabular-nums ${roi >= 0 ? "text-profit" : "text-loss"}`}>
                    {roi.toFixed(2)}%
                  </span>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/65">
                Dashboard balance = starting balance + total P&L from logged trades.
              </p>
            </DashboardInsetPanel>
          </div>

          <div className="relative shrink-0 border-t border-white/[0.06] bg-black/20 px-4 py-4 backdrop-blur-md md:px-6">
            <Button
              type="submit"
              disabled={isSaving}
              className="h-11 w-full bg-gradient-to-r from-cyan-glow to-cyan-glow/80 text-background"
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="size-4 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                  Saving Settings...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Save className="size-4" />
                  Save Settings
                </div>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
