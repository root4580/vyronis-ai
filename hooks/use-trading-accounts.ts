"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createTradingAccountRequest,
  deleteTradingAccountRequest,
  fetchTradingAccounts,
  updateTradingAccountRequest,
} from "@/lib/accounts/api-client"
import type { TradingAccountInput, TradingAccountRecord } from "@/lib/accounts/types"
import { mergeDashboardPreferences, type DashboardPreferences } from "@/lib/user-preferences"

type UseTradingAccountsOptions = {
  supabase: SupabaseClient
  userId?: string | null
  dashboardPreferences?: DashboardPreferences | null
  onPreferencesChange?: (preferences: DashboardPreferences) => void
}

function resolveActiveAccountId(
  accounts: TradingAccountRecord[],
  preferredId: string | null | undefined,
): string | null {
  if (preferredId && accounts.some((account) => account.id === preferredId)) {
    return preferredId
  }
  return (
    accounts.find((account) => account.is_default)?.id ??
    accounts[0]?.id ??
    null
  )
}

export function useTradingAccounts({
  supabase,
  userId,
  dashboardPreferences,
  onPreferencesChange,
}: UseTradingAccountsOptions) {
  const [accounts, setAccounts] = useState<TradingAccountRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dashboardPreferencesRef = useRef(dashboardPreferences)
  const onPreferencesChangeRef = useRef(onPreferencesChange)
  const hasLoadedAccountsRef = useRef(false)
  dashboardPreferencesRef.current = dashboardPreferences
  onPreferencesChangeRef.current = onPreferencesChange

  const activeAccountId = dashboardPreferences?.activeAccountId ?? null

  const activeAccount = useMemo(() => {
    if (accounts.length === 0) return null
    return (
      accounts.find((account) => account.id === activeAccountId) ??
      accounts.find((account) => account.is_default) ??
      accounts[0]
    )
  }, [accounts, activeAccountId])

  const loadAccounts = useCallback(async () => {
    if (!userId) {
      setAccounts([])
      hasLoadedAccountsRef.current = false
      return
    }

    if (!hasLoadedAccountsRef.current) {
      setIsLoading(true)
    }
    setError(null)
    try {
      const nextAccounts = await fetchTradingAccounts()
      setAccounts(nextAccounts)
      hasLoadedAccountsRef.current = true
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load accounts")
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    if (!userId) return

    const refresh = () => {
      if (document.visibilityState === "visible") {
        void loadAccounts()
      }
    }

    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    const interval = setInterval(refresh, 60_000)

    return () => {
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
      clearInterval(interval)
    }
  }, [userId, loadAccounts])

  useEffect(() => {
    if (accounts.length === 0 || !onPreferencesChangeRef.current) return

    const preferredId = dashboardPreferencesRef.current?.activeAccountId ?? null
    const resolvedActiveId = resolveActiveAccountId(accounts, preferredId)
    if (!resolvedActiveId || resolvedActiveId === preferredId) return

    onPreferencesChangeRef.current(
      mergeDashboardPreferences(dashboardPreferencesRef.current, {
        activeAccountId: resolvedActiveId,
      }),
    )
  }, [accounts])

  const persistActiveAccount = useCallback(
    async (accountId: string) => {
      if (!userId) return
      const nextPreferences = mergeDashboardPreferences(dashboardPreferencesRef.current, {
        activeAccountId: accountId,
      })
      onPreferencesChangeRef.current?.(nextPreferences)
      await supabase
        .from("user_settings")
        .update({
          dashboard_preferences: nextPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
    },
    [supabase, userId],
  )

  const switchAccount = useCallback(
    async (accountId: string) => {
      await persistActiveAccount(accountId)
    },
    [persistActiveAccount],
  )

  const createAccount = useCallback(
    async (input: TradingAccountInput) => {
      setIsSaving(true)
      setError(null)
      try {
        const account = await createTradingAccountRequest(input)
        setAccounts((current) => [...current, account])
        await persistActiveAccount(account.id)
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Could not create account")
        throw createError
      } finally {
        setIsSaving(false)
      }
    },
    [persistActiveAccount],
  )

  const updateAccount = useCallback(
    async (
      accountId: string,
      patch: Partial<TradingAccountInput> & { is_default?: boolean },
    ) => {
      setIsSaving(true)
      setError(null)
      try {
        const account = await updateTradingAccountRequest(accountId, patch)
        setAccounts((current) =>
          current.map((row) => {
            if (row.id === account.id) return account
            if (patch.is_default) return { ...row, is_default: false }
            return row
          }),
        )
        if (patch.is_default) {
          await persistActiveAccount(account.id)
        }
      } catch (updateError) {
        setError(updateError instanceof Error ? updateError.message : "Could not update account")
        throw updateError
      } finally {
        setIsSaving(false)
      }
    },
    [persistActiveAccount],
  )

  const deleteAccount = useCallback(
    async (accountId: string) => {
      setIsSaving(true)
      setError(null)
      try {
        await deleteTradingAccountRequest(accountId)
        setAccounts((current) => {
          const next = current.filter((account) => account.id !== accountId)
          if (activeAccountId === accountId && next[0]) {
            void persistActiveAccount(next.find((account) => account.is_default)?.id ?? next[0].id)
          }
          return next
        })
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Could not delete account")
        throw deleteError
      } finally {
        setIsSaving(false)
      }
    },
    [activeAccountId, persistActiveAccount],
  )

  return {
    accounts,
    activeAccount,
    activeAccountId: activeAccount?.id ?? null,
    isLoading,
    isSaving,
    error,
    loadAccounts,
    switchAccount,
    createAccount,
    updateAccount,
    deleteAccount,
  }
}
