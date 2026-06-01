import type { PaperChartAutofillResult } from "@/lib/paper-trades/chart-autofill"
import type {
  ClosePaperTradeInput,
  PaperTradeInput,
  PaperTradeRecord,
  PaperTradeStats,
  PaperVsLiveStats,
} from "@/lib/paper-trades/types"
import type { TradePlanDirection } from "@/lib/trade-planner/types"

const EMPTY_PAPER_STATS: PaperTradeStats = {
  total: 0,
  pending: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  totalPnL: 0,
  avgRR: null,
  winStreak: 0,
  readyForLive: false,
  graduationMessage: null,
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Request failed")
  }
  return payload as T
}

export async function fetchPaperTradesWithStats(
  accountId?: string | null,
): Promise<{ trades: PaperTradeRecord[]; stats: PaperTradeStats }> {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""
  const response = await fetch(`/api/paper-trades${query}`, { cache: "no-store" })
  const payload = await parseJson<{ trades: PaperTradeRecord[]; stats?: PaperTradeStats }>(response)
  return {
    trades: payload.trades ?? [],
    stats: payload.stats ?? EMPTY_PAPER_STATS,
  }
}

export async function fetchPaperTrades(accountId?: string | null): Promise<PaperTradeRecord[]> {
  const { trades } = await fetchPaperTradesWithStats(accountId)
  return trades
}

export async function createPaperTradeRequest(
  input: PaperTradeInput,
): Promise<PaperTradeRecord> {
  const response = await fetch("/api/paper-trades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = await parseJson<{ trade: PaperTradeRecord }>(response)
  return payload.trade
}

export async function closePaperTradeRequest(
  paperTradeId: string,
  input: ClosePaperTradeInput,
): Promise<PaperTradeRecord> {
  const response = await fetch(`/api/paper-trades/${paperTradeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = await parseJson<{ trade: PaperTradeRecord }>(response)
  return payload.trade
}

export async function fetchPaperVsLiveStats(
  accountId?: string | null,
): Promise<PaperVsLiveStats> {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""
  const response = await fetch(`/api/paper-trades/stats${query}`, { cache: "no-store" })
  return parseJson<PaperVsLiveStats>(response)
}

export async function analyzePaperChartAutofill(input: {
  imageUrl: string
  symbolHint?: string
  directionHint?: TradePlanDirection
}): Promise<PaperChartAutofillResult> {
  const response = await fetch("/api/paper-trades/chart-autofill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return parseJson<PaperChartAutofillResult>(response)
}
