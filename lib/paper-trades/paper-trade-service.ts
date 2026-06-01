import type { SupabaseClient } from "@supabase/supabase-js"
import {
  accountScopeOrFilter,
  resolveActiveAccountId,
  resolveLegacyTradeAccountId,
} from "@/lib/accounts/server-active-account"
import { computePaperTradeStats } from "@/lib/paper-trades/stats"
import type {
  ClosePaperTradeInput,
  PaperTradeInput,
  PaperTradeRecord,
  PaperVsLiveStats,
} from "@/lib/paper-trades/types"
import { getSignedPnL } from "@/lib/trade-utils"

function normalizeRow(row: Record<string, unknown>): PaperTradeRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    account_id: row.account_id != null ? String(row.account_id) : null,
    symbol: String(row.symbol),
    direction: String(row.direction),
    entry: row.entry != null ? Number(row.entry) : null,
    sl: row.sl != null ? Number(row.sl) : null,
    tp: row.tp != null ? Number(row.tp) : null,
    close_price: row.close_price != null ? Number(row.close_price) : null,
    result: (String(row.result).toUpperCase() as PaperTradeRecord["result"]) ?? "PENDING",
    pips: row.pips != null ? Number(row.pips) : null,
    rr: row.rr != null ? Number(row.rr) : null,
    pnl: Number(row.pnl ?? 0),
    is_paper: row.is_paper !== false,
    notes: String(row.notes ?? ""),
    source: (String(row.source ?? "practice") as PaperTradeRecord["source"]) ?? "practice",
    source_ref: row.source_ref != null ? String(row.source_ref) : null,
    setup_grade: row.setup_grade != null ? String(row.setup_grade) : null,
    chart_image_url: row.chart_image_url != null ? String(row.chart_image_url) : null,
    ai_confidence: row.ai_confidence != null ? String(row.ai_confidence) : null,
    coach_session_id: row.coach_session_id != null ? String(row.coach_session_id) : null,
    coach_feedback: row.coach_feedback != null ? String(row.coach_feedback) : null,
    entry_at: String(row.entry_at ?? row.created_at),
    created_at: String(row.created_at),
    closed_at: row.closed_at != null ? String(row.closed_at) : null,
  }
}

export class PaperTradesTableMissingError extends Error {
  constructor() {
    super("Paper trades table is missing. Run supabase/037-paper-trades.sql in Supabase.")
    this.name = "PaperTradesTableMissingError"
  }
}

function isMissingTableError(message: string): boolean {
  return /paper_trades|relation .* does not exist|schema cache/i.test(message)
}

export async function listPaperTrades(
  supabase: SupabaseClient,
  userId: string,
  accountId: string | null,
  legacyAccountId: string | null,
): Promise<PaperTradeRecord[]> {
  let query = supabase
    .from("paper_trades")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200)

  if (accountId) {
    query = query.or(accountScopeOrFilter(accountId, legacyAccountId))
  }

  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error.message)) throw new PaperTradesTableMissingError()
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => normalizeRow(row as Record<string, unknown>))
}

export async function createPaperTrade(
  supabase: SupabaseClient,
  userId: string,
  accountId: string | null,
  input: PaperTradeInput,
): Promise<PaperTradeRecord> {
  const payload = {
    user_id: userId,
    account_id: accountId ?? input.account_id ?? null,
    symbol: input.symbol.trim().toUpperCase(),
    direction: input.direction.trim().toUpperCase(),
    entry: input.entry ?? null,
    sl: input.sl ?? null,
    tp: input.tp ?? null,
    notes: input.notes?.trim() ?? "",
    source: input.source ?? "practice",
    source_ref: input.source_ref ?? null,
    setup_grade: input.setup_grade ?? null,
    chart_image_url: input.chart_image_url ?? null,
    ai_confidence: input.ai_confidence ?? null,
    coach_session_id: input.coach_session_id ?? null,
    coach_feedback: input.coach_feedback ?? null,
    result: "PENDING",
    is_paper: true,
    pnl: 0,
  }

  const { data, error } = await supabase.from("paper_trades").insert(payload).select("*").single()
  if (error) {
    if (isMissingTableError(error.message)) throw new PaperTradesTableMissingError()
    throw new Error(error.message)
  }

  return normalizeRow(data as Record<string, unknown>)
}

export async function closePaperTrade(
  supabase: SupabaseClient,
  userId: string,
  paperTradeId: string,
  input: ClosePaperTradeInput,
): Promise<PaperTradeRecord> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("paper_trades")
    .update({
      close_price: input.close_price,
      result: input.result,
      pips: input.pips ?? null,
      rr: input.rr ?? null,
      pnl: input.pnl ?? 0,
      notes: input.notes,
      closed_at: now,
    })
    .eq("user_id", userId)
    .eq("id", paperTradeId)
    .select("*")
    .single()

  if (error) {
    if (isMissingTableError(error.message)) throw new PaperTradesTableMissingError()
    throw new Error(error.message)
  }

  return normalizeRow(data as Record<string, unknown>)
}

export async function getPaperVsLiveStats(
  supabase: SupabaseClient,
  userId: string,
  accountId: string | null,
): Promise<PaperVsLiveStats> {
  const legacyAccountId = accountId
    ? await resolveLegacyTradeAccountId(supabase, userId)
    : null

  const paperTrades = accountId
    ? await listPaperTrades(supabase, userId, accountId, legacyAccountId)
    : []

  let liveQuery = supabase
    .from("trades")
    .select("pnl, result, risk_reward")
    .eq("user_id", userId)

  if (accountId && legacyAccountId != null) {
    liveQuery = liveQuery.or(accountScopeOrFilter(accountId, legacyAccountId))
  }

  const { data: liveRows, error } = await liveQuery.limit(500)
  if (error && !/account_id|column/i.test(error.message)) {
    throw new Error(error.message)
  }

  const liveTrades = (liveRows ?? []) as Array<{
    pnl: number | null
    result: string | null
    risk_reward: number | null
  }>

  const liveWins = liveTrades.filter((trade) => trade.result?.toUpperCase() === "WIN").length
  const liveLosses = liveTrades.filter((trade) => trade.result?.toUpperCase() === "LOSS").length
  const liveClosed = liveTrades.filter((trade) => {
    const result = trade.result?.toUpperCase()
    return result && result !== "BREAKEVEN" && result !== "PENDING"
  })
  const livePnL = liveTrades.reduce(
    (sum, trade) => sum + getSignedPnL(trade.pnl ?? 0, trade.result ?? ""),
    0,
  )
  const liveRR = liveTrades
    .map((trade) => trade.risk_reward)
    .filter((value): value is number => value != null && Number.isFinite(value))

  return {
    paper: computePaperTradeStats(paperTrades),
    live: {
      total: liveTrades.length,
      wins: liveWins,
      losses: liveLosses,
      winRate: liveClosed.length > 0 ? Math.round((liveWins / liveClosed.length) * 100) : 0,
      totalPnL: livePnL,
      avgRR:
        liveRR.length > 0 ? liveRR.reduce((sum, value) => sum + value, 0) / liveRR.length : null,
    },
  }
}

export async function resolvePaperTradeContext(
  supabase: SupabaseClient,
  userId: string,
  request?: Request,
) {
  const accountId = await resolveActiveAccountId(supabase, userId, request)
  const legacyAccountId = accountId
    ? await resolveLegacyTradeAccountId(supabase, userId)
    : null
  return { accountId, legacyAccountId }
}
