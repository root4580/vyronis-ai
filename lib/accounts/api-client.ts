import type {
  TradingAccountInput,
  TradingAccountRecord,
  TradingAccountUpdate,
} from "@/lib/accounts/types"

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : "Request failed",
    )
  }
  return payload as T
}

export async function fetchTradingAccounts(): Promise<TradingAccountRecord[]> {
  const response = await fetch("/api/accounts", { cache: "no-store" })
  const payload = await parseJson<{ accounts: TradingAccountRecord[] }>(response)
  return payload.accounts ?? []
}

export async function createTradingAccountRequest(
  input: TradingAccountInput,
): Promise<TradingAccountRecord> {
  const response = await fetch("/api/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = await parseJson<{ account: TradingAccountRecord }>(response)
  return payload.account
}

export async function updateTradingAccountRequest(
  accountId: string,
  patch: TradingAccountUpdate,
): Promise<TradingAccountRecord> {
  const response = await fetch(`/api/accounts/${accountId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
  const payload = await parseJson<{ account: TradingAccountRecord }>(response)
  return payload.account
}

export async function deleteTradingAccountRequest(accountId: string): Promise<void> {
  const response = await fetch(`/api/accounts/${accountId}`, { method: "DELETE" })
  await parseJson<{ ok: boolean }>(response)
}

export async function lockTradingAccountRequest(accountId: string): Promise<void> {
  const response = await fetch(`/api/accounts/${accountId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lockStartingBalance: true }),
  })
  await parseJson<{ account: TradingAccountRecord }>(response)
}
