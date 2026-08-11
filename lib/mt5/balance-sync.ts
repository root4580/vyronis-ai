import type { SupabaseClient } from "@supabase/supabase-js"
import { filterRowsForAccount, resolveLegacyTradeAccountId } from "@/lib/accounts/account-query"
import {
  ensureDefaultTradingAccount,
  listTradingAccounts,
} from "@/lib/accounts/trading-account-service"
import type { TradingAccountRecord } from "@/lib/accounts/types"
import { journalTradesOrFilter } from "@/lib/analytics/trade-scope"
import { computeBalanceFromTradeLog } from "@/lib/account-status"
import type { SettingsTrade } from "@/lib/user-settings"
import { getSignedPnL } from "@/lib/trade-utils"
import { fetchAllRowsPaginated } from "@/lib/trades/fetch-all-paginated"

export type Mt5BalanceSyncResult = {
  synced: boolean
  accountId?: string
  startingBalance?: number
  accountBalance?: number
  totalPnL?: number
  reason?: string
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function pickAccountForMt5(
  accounts: TradingAccountRecord[],
  accountLogin?: string | null,
  broker?: string | null,
): TradingAccountRecord | null {
  if (accounts.length === 0) return null

  const login = accountLogin?.trim()
  const brokerNorm = broker?.trim().toLowerCase()

  if (brokerNorm) {
    const brokerMatch = accounts.find((a) => a.broker.trim().toLowerCase() === brokerNorm)
    if (brokerMatch) return brokerMatch
  }

  if (login) {
    const loginMatch = accounts.find(
      (a) =>
        a.name.includes(login) ||
        a.broker.includes(login) ||
        `${a.broker} ${a.name}`.toLowerCase().includes(login.toLowerCase()),
    )
    if (loginMatch) return loginMatch
  }

  return accounts.find((a) => a.is_default) ?? accounts[0] ?? null
}

function mapTradeRow(row: {
  pnl: number | null
  result: string | null
  account_id?: string | null
  trade_date?: string | null
  created_at?: string | null
}): SettingsTrade & { account_id?: string | null } {
  return {
    pnl: Number(row.pnl ?? 0),
    result: row.result ?? "BE",
    trade_date: row.trade_date ?? undefined,
    created_at: row.created_at ?? "",
    risk_percent: null,
    rule_followed: null,
    emotion: "",
    account_id: row.account_id ?? undefined,
  }
}

/**
 * Align Vyronis account balance with MT5 live balance:
 * starting_balance = mt5_balance - sum(journal P&L)
 * so starting_balance + P&L === mt5_balance on the dashboard.
 */
export async function reconcileVyronisBalanceFromMt5(
  supabase: SupabaseClient,
  userId: string,
  mt5Balance: number,
  options?: { accountLogin?: string | null; broker?: string | null },
): Promise<Mt5BalanceSyncResult> {
  if (!Number.isFinite(mt5Balance) || mt5Balance <= 0) {
    return { synced: false, reason: "Invalid MT5 balance." }
  }

  let accounts: TradingAccountRecord[] = []
  try {
    accounts = await listTradingAccounts(supabase, userId)
  } catch {
    accounts = []
  }

  let account = pickAccountForMt5(accounts, options?.accountLogin, options?.broker)

  if (!account) {
    try {
      account = await ensureDefaultTradingAccount(supabase, userId, mt5Balance)
      accounts = [account]
    } catch {
      account = null
    }
  }

  const { rows: tradeRows, error: tradesErrorMessage } = await fetchAllRowsPaginated<{
    pnl: number | null
    result: string | null
    account_id: string | null
    trade_date: string | null
    created_at: string
  }>((from, to) =>
    supabase
      .from("trades")
      .select("pnl, result, account_id, trade_date, created_at")
      .eq("user_id", userId)
      .or(journalTradesOrFilter())
      .range(from, to),
  )

  if (tradesErrorMessage) {
    return { synced: false, reason: tradesErrorMessage.message }
  }

  const legacyAccountId = resolveLegacyTradeAccountId(accounts)
  const scopedTrades = account
    ? filterRowsForAccount(
        tradeRows.map(mapTradeRow),
        account.id,
        legacyAccountId,
      )
    : tradeRows.map(mapTradeRow)

  const totalPnL = scopedTrades.reduce(
    (sum, trade) => sum + getSignedPnL(trade.pnl, trade.result),
    0,
  )
  const newStartingBalance = roundMoney(Math.max(0, mt5Balance - totalPnL))
  const { accountBalance } = computeBalanceFromTradeLog(scopedTrades, newStartingBalance)

  if (account) {
    const accountPatch: Record<string, unknown> = {
      starting_balance: newStartingBalance,
      updated_at: new Date().toISOString(),
    }
    const broker = options?.broker?.trim()
    if (broker && !account.broker.trim()) {
      accountPatch.broker = broker
    }

    const { error: accountError } = await supabase
      .from("accounts")
      .update(accountPatch)
      .eq("user_id", userId)
      .eq("id", account.id)

    if (accountError) {
      return { synced: false, reason: accountError.message }
    }
  }

  const settingsPatch: Record<string, unknown> = {
    starting_balance: newStartingBalance,
    updated_at: new Date().toISOString(),
  }

  const { error: settingsError } = await supabase
    .from("user_settings")
    .update(settingsPatch)
    .eq("user_id", userId)

  if (settingsError) {
    return { synced: false, reason: settingsError.message }
  }

  return {
    synced: true,
    accountId: account?.id,
    startingBalance: newStartingBalance,
    accountBalance: roundMoney(mt5Balance),
    totalPnL: roundMoney(totalPnL),
  }
}
