"use client"

import { useMemo, useState } from "react"
import { Loader2, Plus, Star, Trash2 } from "lucide-react"
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
import { formatAccountMoney } from "@/lib/accounts/profit-target"
import {
  ACCOUNT_TYPE_LABELS,
  SUPPORTED_CURRENCIES,
  type TradingAccountInput,
  type TradingAccountRecord,
  type TradingAccountType,
} from "@/lib/accounts/types"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

type TradingAccountsPanelProps = {
  accounts: TradingAccountRecord[]
  activeAccountId: string | null
  isLoading?: boolean
  isSaving?: boolean
  loadError?: string | null
  onCreate: (input: TradingAccountInput) => Promise<void>
  onUpdate: (accountId: string, patch: Partial<TradingAccountInput> & { is_default?: boolean }) => Promise<void>
  onDelete: (accountId: string) => Promise<void>
  onSwitch: (accountId: string) => void
}

const EMPTY_DRAFT: TradingAccountInput = {
  name: "",
  broker: "",
  starting_balance: 10000,
  account_type: "prop_firm",
  currency: "USD",
  max_drawdown_pct: 10,
  max_trades_per_week: 2,
  loss_streak_limit: 3,
  min_emotional_score: 7,
}

function inferStartingBalanceFromName(name: string): number | null {
  const match = name.match(/(\d+(?:\.\d+)?)\s*([kKmM])\b/)
  if (!match) return null
  const value = Number.parseFloat(match[1])
  if (!Number.isFinite(value) || value <= 0) return null
  const unit = match[2].toLowerCase()
  if (unit === "m") return value * 1_000_000
  return value * 1_000
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground/80">
      {children}
    </Label>
  )
}

export function TradingAccountsPanel({
  accounts,
  activeAccountId,
  isLoading = false,
  isSaving = false,
  loadError = null,
  onCreate,
  onUpdate,
  onDelete,
  onSwitch,
}: TradingAccountsPanelProps) {
  const { toast } = useToast()
  const [draft, setDraft] = useState<TradingAccountInput>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<TradingAccountInput>(EMPTY_DRAFT)
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editingAccount = useMemo(
    () => accounts.find((account) => account.id === editingId) ?? null,
    [accounts, editingId],
  )

  function startEdit(account: TradingAccountRecord) {
    setEditingId(account.id)
    setEditDraft({
      name: account.name,
      broker: account.broker,
      starting_balance: account.starting_balance,
      account_type: account.account_type,
      currency: account.currency,
      max_drawdown_pct: account.max_drawdown_pct,
      max_trades_per_week: account.max_trades_per_week ?? 2,
      loss_streak_limit: account.loss_streak_limit ?? 3,
      min_emotional_score: account.min_emotional_score ?? 7,
    })
    setError(null)
  }

  async function handleCreate() {
    setError(null)

    const name = draft.name.trim()
    if (!name) {
      setError("Account name is required")
      return
    }
    if (!Number.isFinite(draft.starting_balance) || draft.starting_balance <= 0) {
      setError("Starting balance must be greater than 0")
      return
    }

    try {
      await onCreate({ ...draft, name })
      setDraft(EMPTY_DRAFT)
      setShowCreate(false)
      toast({
        title: "Account created",
        description: `${name} is active now. Stats start fresh at ${formatAccountMoney(draft.starting_balance, draft.currency ?? "USD")}.`,
      })
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : "Could not create account"
      setError(message)
      toast({
        title: "Could not create account",
        description: message,
        variant: "destructive",
      })
    }
  }

  async function handleSaveEdit() {
    if (!editingId) return
    setError(null)
    try {
      await onUpdate(editingId, editDraft)
      setEditingId(null)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update account")
    }
  }

  async function handleDelete(accountId: string) {
    setError(null)
    try {
      await onDelete(accountId)
      if (editingId === accountId) setEditingId(null)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete account")
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">
            Trading accounts
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            Each account has its own trades and stats. Use the account switcher in the top bar after creating one.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1 border-white/[0.08] bg-white/[0.03]"
          onClick={() => {
            setShowCreate((open) => !open)
            setError(null)
          }}
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>

      {error || loadError ? (
        <p className="rounded-[var(--radius-sm)] border border-loss/25 bg-loss/[0.08] px-2.5 py-2 text-[11px] text-loss">
          {error ?? loadError}
        </p>
      ) : null}

      {showCreate ? (
        <div
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault()
          }}
        >
          <DashboardInsetPanel className="space-y-3">
            <AccountFormFields
              draft={draft}
              inferBalanceFromName
              onChange={setDraft}
            />
          <div className="flex gap-2">
            <Button type="button" size="sm" className="btn-primary h-8" disabled={isSaving} onClick={() => void handleCreate()}>
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : "Create account"}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
          </DashboardInsetPanel>
        </div>
      ) : null}

      <div className="space-y-2">
        {isLoading && accounts.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-[11px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading accounts…
          </div>
        ) : null}

        {accounts.map((account) => {
          const isActive = account.id === activeAccountId
          const isEditing = editingId === account.id

          return (
            <DashboardInsetPanel
              key={account.id}
              className={cn(
                "space-y-3",
                isActive && "border-cyan-glow/25 bg-cyan-glow/[0.04]",
              )}
            >
              {isEditing ? (
                <>
                  <AccountFormFields
                    draft={editDraft}
                    onChange={setEditDraft}
                    startingBalanceLocked={account.starting_balance_locked}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" className="btn-primary h-8" disabled={isSaving} onClick={() => void handleSaveEdit()}>
                      Save changes
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[13px] font-medium text-foreground">{account.name}</p>
                        {account.is_default ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-cyan-glow/25 bg-cyan-glow/10 px-1.5 py-0.5 text-[9px] text-cyan-glow">
                            <Star className="size-2.5" />
                            Default
                          </span>
                        ) : null}
                        {isActive ? (
                          <span className="rounded-full border border-profit/25 bg-profit/10 px-1.5 py-0.5 text-[9px] text-profit">
                            Active
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/75">
                        {account.broker || ACCOUNT_TYPE_LABELS[account.account_type]} · Max DD{" "}
                        {account.max_drawdown_pct}%
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!isActive ? (
                        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => onSwitch(account.id)}>
                          Switch
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => startEdit(account)}>
                        Edit
                      </Button>
                      {accounts.length > 1 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-loss hover:text-loss"
                          onClick={() => void handleDelete(account.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-[11px]">
                    <span className="text-muted-foreground/75">Starting balance</span>
                    <p className="font-medium tabular-nums">
                      {formatAccountMoney(account.starting_balance, account.currency)}
                    </p>
                  </div>

                  {account.starting_balance_locked ? (
                    <p className="text-[10px] text-muted-foreground/70">
                      Starting balance locked after first logged trade.
                    </p>
                  ) : null}

                  {!account.is_default ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 border-white/[0.08] text-[10px]"
                      disabled={isSaving}
                      onClick={() => void onUpdate(account.id, { is_default: true })}
                    >
                      Set as default
                    </Button>
                  ) : null}
                </>
              )}
            </DashboardInsetPanel>
          )
        })}
      </div>
    </section>
  )
}

function AccountFormFields({
  draft,
  onChange,
  startingBalanceLocked = false,
  inferBalanceFromName = false,
}: {
  draft: TradingAccountInput
  onChange: (next: TradingAccountInput) => void
  startingBalanceLocked?: boolean
  inferBalanceFromName?: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <FieldLabel>Account name</FieldLabel>
        <Input
          value={draft.name}
          onChange={(event) => {
            const name = event.target.value
            const inferred = inferBalanceFromName ? inferStartingBalanceFromName(name) : null
            onChange({
              ...draft,
              name,
              ...(inferred != null && !startingBalanceLocked
                ? { starting_balance: inferred }
                : {}),
            })
          }}
          placeholder="FTMO 100K"
          className="add-trade-input h-10"
        />
      </div>
      <div className="space-y-2">
        <FieldLabel>Broker / Firm</FieldLabel>
        <Input
          value={draft.broker ?? ""}
          onChange={(event) => onChange({ ...draft, broker: event.target.value })}
          placeholder="FTMO"
          className="add-trade-input h-10"
        />
      </div>
      <div className="space-y-2">
        <FieldLabel>Account type</FieldLabel>
        <Select
          value={draft.account_type ?? "prop_firm"}
          onValueChange={(value) => onChange({ ...draft, account_type: value as TradingAccountType })}
        >
          <SelectTrigger className="add-trade-input h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="glass-card border-white/[0.08]">
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <FieldLabel>Starting balance</FieldLabel>
        <Input
          type="number"
          step="100"
          min="0"
          value={draft.starting_balance}
          disabled={startingBalanceLocked}
          onChange={(event) =>
            onChange({ ...draft, starting_balance: parseFloat(event.target.value) || 0 })
          }
          className="add-trade-input h-10 tabular-nums"
        />
        {startingBalanceLocked ? (
          <p className="text-[10px] text-muted-foreground/70">Locked after first trade</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <FieldLabel>Currency</FieldLabel>
        <Select
          value={draft.currency ?? "USD"}
          onValueChange={(value) => onChange({ ...draft, currency: value })}
        >
          <SelectTrigger className="add-trade-input h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="glass-card border-white/[0.08]">
            {SUPPORTED_CURRENCIES.map((currency) => (
              <SelectItem key={currency} value={currency}>
                {currency}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <FieldLabel>Max drawdown (%)</FieldLabel>
        <Input
          type="number"
          step="0.5"
          min="1"
          max="100"
          value={draft.max_drawdown_pct ?? 10}
          onChange={(event) =>
            onChange({ ...draft, max_drawdown_pct: parseFloat(event.target.value) || 10 })
          }
          className="add-trade-input h-10 tabular-nums"
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/75">
          Rule enforcement (per account)
        </p>
      </div>
      <div className="space-y-2">
        <FieldLabel>Max trades per week</FieldLabel>
        <Input
          type="number"
          min={1}
          max={50}
          step={1}
          value={draft.max_trades_per_week ?? 2}
          onChange={(event) =>
            onChange({
              ...draft,
              max_trades_per_week: parseInt(event.target.value, 10) || 2,
            })
          }
          className="add-trade-input h-10 tabular-nums"
        />
      </div>
      <div className="space-y-2">
        <FieldLabel>Loss streak limit</FieldLabel>
        <Input
          type="number"
          min={2}
          max={10}
          step={1}
          value={draft.loss_streak_limit ?? 3}
          onChange={(event) =>
            onChange({
              ...draft,
              loss_streak_limit: parseInt(event.target.value, 10) || 3,
            })
          }
          className="add-trade-input h-10 tabular-nums"
        />
      </div>
      <div className="space-y-2">
        <FieldLabel>Min emotional score</FieldLabel>
        <Input
          type="number"
          min={1}
          max={10}
          step={1}
          value={draft.min_emotional_score ?? 7}
          onChange={(event) =>
            onChange({
              ...draft,
              min_emotional_score: parseInt(event.target.value, 10) || 7,
            })
          }
          className="add-trade-input h-10 tabular-nums"
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <FieldLabel>Account size</FieldLabel>
        <p className="text-[12px] font-medium tabular-nums text-text-primary">
          {formatAccountMoney(draft.starting_balance, draft.currency ?? "USD")} — set in starting balance above
        </p>
      </div>
    </div>
  )
}
