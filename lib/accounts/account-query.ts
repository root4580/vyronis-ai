export type AccountScopedRow = {
  account_id?: string | null
}

/**
 * Legacy trades without account_id belong to the user's first (oldest) account only —
 * never to newly created accounts even if they become default.
 */
export function belongsToAccount<T extends AccountScopedRow>(
  row: T,
  accountId: string | null | undefined,
  legacyAccountId?: string | null,
): boolean {
  if (!accountId) return false
  if (row.account_id) return row.account_id === accountId
  if (!row.account_id && legacyAccountId) return accountId === legacyAccountId
  return false
}

export function filterRowsForAccount<T extends AccountScopedRow>(
  rows: T[],
  accountId: string | null | undefined,
  legacyAccountId?: string | null,
): T[] {
  if (!accountId) return []
  return rows.filter((row) => belongsToAccount(row, accountId, legacyAccountId))
}

export function resolveLegacyTradeAccountId<
  T extends { id: string; created_at: string },
>(accounts: T[]): string | null {
  if (accounts.length === 0) return null
  return [...accounts].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]?.id ?? null
}
