"use client"

import { ChevronDown, Wallet } from "lucide-react"
import type { TradingAccountRecord } from "@/lib/accounts/types"
import { formatAccountMoney } from "@/lib/accounts/profit-target"
import { getAccountAccentStyles } from "@/lib/accounts/account-theme"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type AccountSwitcherProps = {
  accounts: TradingAccountRecord[]
  activeAccountId: string | null
  onSwitch: (accountId: string) => void
  isLoading?: boolean
  className?: string
}

function AccountColorDot({ account, className }: { account: TradingAccountRecord; className?: string }) {
  const styles = getAccountAccentStyles(account)
  return <span className={cn("size-2 shrink-0 rounded-full", styles.dot, className)} aria-hidden />
}

export function AccountSwitcher({
  accounts,
  activeAccountId,
  onSwitch,
  isLoading = false,
  className,
}: AccountSwitcherProps) {
  const activeAccount =
    accounts.find((account) => account.id === activeAccountId) ??
    accounts.find((account) => account.is_default) ??
    accounts[0]

  const activeStyles = activeAccount ? getAccountAccentStyles(activeAccount) : getAccountAccentStyles({ accent_color: "cyan" })

  if (accounts.length === 0) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-text-muted",
          className,
        )}
      >
        <Wallet className="size-3.5" />
        {isLoading ? "Loading accounts…" : "No accounts"}
      </div>
    )
  }

  if (accounts.length === 1 && activeAccount) {
    return (
      <div
        className={cn(
          "inline-flex max-w-[280px] items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 py-1.5",
          activeStyles.border,
          activeStyles.bg,
          className,
        )}
      >
        <AccountColorDot account={activeAccount} />
        <Wallet className={cn("size-3.5 shrink-0", activeStyles.text)} />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-text-primary">{activeAccount.name}</p>
          <p className="truncate text-[10px] text-text-muted">
            {formatAccountMoney(activeAccount.starting_balance, activeAccount.currency)} start · Settings → Add for more
          </p>
        </div>
      </div>
    )
  }

  return (
    <Select value={activeAccount?.id} onValueChange={onSwitch}>
      <SelectTrigger
        className={cn(
          "h-auto min-h-9 w-[min(100%,240px)] gap-2 rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-left",
          activeStyles.border,
          activeStyles.bg,
          className,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {activeAccount ? <AccountColorDot account={activeAccount} className="mt-0.5" /> : null}
          <Wallet className={cn("size-3.5 shrink-0", activeStyles.text)} />
          <div className="min-w-0 flex-1">
            <SelectValue placeholder="Select account">
              <span className="block truncate text-[11px] font-medium text-text-primary">
                {activeAccount?.name}
              </span>
            </SelectValue>
            <span className="block truncate text-[10px] text-text-muted">
              {activeAccount
                ? formatAccountMoney(activeAccount.starting_balance, activeAccount.currency)
                : ""}{" "}
              start
            </span>
          </div>
          <ChevronDown className="size-3.5 shrink-0 text-text-muted" />
        </div>
      </SelectTrigger>
      <SelectContent className="glass-card border-white/[0.08]">
        {accounts.map((account) => {
          const styles = getAccountAccentStyles(account)
          return (
            <SelectItem key={account.id} value={account.id} className="text-[12px]">
              <div className="flex items-start gap-2">
                <AccountColorDot account={account} className="mt-1" />
                <div className="flex flex-col">
                  <span>{account.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {account.broker || account.account_type} ·{" "}
                    {formatAccountMoney(account.starting_balance, account.currency)}
                  </span>
                </div>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
