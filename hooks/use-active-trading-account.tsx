"use client"

import { useMemo } from "react"
import { AccountSwitcher } from "@/components/dashboard/account-switcher"
import type { SupabaseClient } from "@supabase/supabase-js"
import { filterTradesForAccount } from "@/lib/account-status"
import { resolveLegacyTradeAccountId } from "@/lib/accounts/account-query"
import { useTradingAccounts } from "@/hooks/use-trading-accounts"
import type { DashboardPreferences } from "@/lib/user-preferences"

type UseActiveTradingAccountOptions = {
  supabase: SupabaseClient
  userId?: string | null
  dashboardPreferences?: DashboardPreferences | null
  onPreferencesChange?: (preferences: DashboardPreferences) => void
}

export function useActiveTradingAccount(options: UseActiveTradingAccountOptions) {
  const accountsState = useTradingAccounts(options)

  const defaultAccountId = useMemo(
    () => accountsState.accounts.find((account) => account.is_default)?.id ?? null,
    [accountsState.accounts],
  )

  const legacyTradeAccountId = useMemo(
    () => resolveLegacyTradeAccountId(accountsState.accounts),
    [accountsState.accounts],
  )

  const filterForActiveAccount = <T extends { account_id?: string | null }>(rows: T[]): T[] =>
    filterTradesForAccount(rows, accountsState.activeAccountId, legacyTradeAccountId)

  const accountSwitcher = (
    <AccountSwitcher
      accounts={accountsState.accounts}
      activeAccountId={accountsState.activeAccountId}
      onSwitch={(accountId) => void accountsState.switchAccount(accountId)}
      isLoading={accountsState.isLoading}
    />
  )

  return {
    ...accountsState,
    defaultAccountId,
    legacyTradeAccountId,
    filterForActiveAccount,
    accountSwitcher,
  }
}
