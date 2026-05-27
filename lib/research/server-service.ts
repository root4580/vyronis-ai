import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildImportPreview,
  dedupeWithinBatch,
  filterImportableTrades,
} from "@/lib/research/dedupe"
import { assertResearchLabEnabled, ResearchLabTableMissingError } from "@/lib/research/feature-flag"
import { parseMt5Csv } from "@/lib/research/mt5-csv-parser"
import { normalizeMt5CsvRows } from "@/lib/research/trade-normalizer"
import type {
  CsvImportResult,
  ImportPreviewRow,
  NormalizedResearchTrade,
  ResearchImportError,
  ResearchStrategyInput,
  ResearchStrategyRecord,
} from "@/lib/research/types"

const INSERT_BATCH_SIZE = 100

function isMissingResearchTableError(error: { message?: string; code?: string } | null) {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /research_strategies|research_import_batches|import_source|research_strategy_id/i.test(
      error.message || "",
    )
  )
}

export async function listResearchStrategies(
  supabase: SupabaseClient,
  userId: string,
): Promise<ResearchStrategyRecord[]> {
  await assertResearchLabEnabled(supabase, userId)

  const { data, error } = await supabase
    .from("research_strategies")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })

  if (error) {
    if (isMissingResearchTableError(error)) {
      throw new ResearchLabTableMissingError()
    }
    throw new Error(error.message)
  }

  return (data ?? []) as ResearchStrategyRecord[]
}

export async function createResearchStrategy(
  supabase: SupabaseClient,
  userId: string,
  input: ResearchStrategyInput,
): Promise<ResearchStrategyRecord> {
  await assertResearchLabEnabled(supabase, userId)

  const name = input.name.trim()
  if (!name) {
    throw new Error("Strategy name is required.")
  }

  const { data, error } = await supabase
    .from("research_strategies")
    .insert({
      user_id: userId,
      name,
      description: input.description?.trim() || "",
      magic_number: input.magic_number ?? null,
      color: input.color || "#22d3ee",
      account_type: "demo",
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (error) {
    if (isMissingResearchTableError(error)) {
      throw new ResearchLabTableMissingError()
    }
    throw new Error(error.message)
  }

  return data as ResearchStrategyRecord
}

async function fetchExistingTickets(
  supabase: SupabaseClient,
  userId: string,
  tickets: string[],
): Promise<Set<string>> {
  if (tickets.length === 0) return new Set()

  const { data, error } = await supabase
    .from("trades")
    .select("external_ticket")
    .eq("user_id", userId)
    .eq("import_source", "mt5_csv")
    .in("external_ticket", tickets)

  if (error) {
    if (isMissingResearchTableError(error)) {
      throw new ResearchLabTableMissingError()
    }
    throw new Error(error.message)
  }

  return new Set(
    (data ?? [])
      .map((row) => row.external_ticket)
      .filter((ticket): ticket is string => Boolean(ticket)),
  )
}

async function getResearchStrategy(
  supabase: SupabaseClient,
  userId: string,
  strategyId: string,
): Promise<ResearchStrategyRecord> {
  const { data, error } = await supabase
    .from("research_strategies")
    .select("*")
    .eq("user_id", userId)
    .eq("id", strategyId)
    .maybeSingle()

  if (error) {
    if (isMissingResearchTableError(error)) {
      throw new ResearchLabTableMissingError()
    }
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error("Research strategy not found.")
  }

  if (data.account_type !== "demo") {
    throw new Error("Only demo research strategies are supported.")
  }

  return data as ResearchStrategyRecord
}

function toTradeInsertPayload(
  trade: NormalizedResearchTrade,
  userId: string,
  strategy: ResearchStrategyRecord,
  batchId: string,
) {
  return {
    user_id: userId,
    pair: trade.pair,
    direction: trade.direction,
    result: trade.result,
    pnl: trade.pnl,
    emotion: "Calm",
    setup: "MT5 Import",
    strategy_name: strategy.name,
    session: trade.session,
    risk_percent: 1,
    rule_followed: null,
    trade_date: trade.trade_date,
    stop_loss: trade.stop_loss,
    take_profit: trade.take_profit,
    risk_reward: trade.risk_reward,
    trade_notes: trade.trade_notes,
    research_strategy_id: strategy.id,
    import_source: "mt5_csv",
    import_batch_id: batchId,
    external_ticket: trade.external_ticket,
    magic_number: trade.magic_number ?? strategy.magic_number,
    broker: trade.broker,
    account_login: trade.account_login,
    opened_at: trade.opened_at,
    closed_at: trade.closed_at,
    lots: trade.lots,
    commission: trade.commission,
    swap: trade.swap,
    raw_payload: trade.raw_payload,
    updated_at: new Date().toISOString(),
  }
}

export async function previewMt5CsvImport(
  supabase: SupabaseClient,
  userId: string,
  csvContent: string,
  researchStrategyId: string,
): Promise<{ preview: ImportPreviewRow[]; errors: ResearchImportError[] }> {
  await assertResearchLabEnabled(supabase, userId)
  await getResearchStrategy(supabase, userId, researchStrategyId)

  const parsed = parseMt5Csv(csvContent)
  const { trades, errors } = normalizeMt5CsvRows(parsed.rows)
  const { unique, duplicatesInBatch } = dedupeWithinBatch(trades)
  const existingTickets = await fetchExistingTickets(
    supabase,
    userId,
    unique.map((trade) => trade.external_ticket),
  )

  const preview = buildImportPreview(trades, existingTickets, duplicatesInBatch)
  return { preview, errors }
}

export async function importMt5Csv(
  supabase: SupabaseClient,
  userId: string,
  options: {
    csvContent: string
    researchStrategyId: string
    filename?: string
    dryRun?: boolean
  },
): Promise<CsvImportResult> {
  await assertResearchLabEnabled(supabase, userId)
  const strategy = await getResearchStrategy(supabase, userId, options.researchStrategyId)

  const parsed = parseMt5Csv(options.csvContent)
  const { trades, errors: normalizeErrors } = normalizeMt5CsvRows(parsed.rows)
  const { unique, duplicatesInBatch } = dedupeWithinBatch(trades)
  const existingTickets = await fetchExistingTickets(
    supabase,
    userId,
    unique.map((trade) => trade.external_ticket),
  )

  const preview = buildImportPreview(trades, existingTickets, duplicatesInBatch)
  const importable = filterImportableTrades(trades, existingTickets)

  if (options.dryRun) {
    return {
      batchId: "",
      imported: importable.length,
      skipped: trades.length - importable.length,
      errors: normalizeErrors,
      preview,
    }
  }

  const { data: batch, error: batchError } = await supabase
    .from("research_import_batches")
    .insert({
      user_id: userId,
      research_strategy_id: strategy.id,
      source: "mt5_csv",
      filename: options.filename || null,
      row_count: parsed.rows.length,
      status: "pending",
    })
    .select("id")
    .single()

  if (batchError || !batch) {
    if (isMissingResearchTableError(batchError)) {
      throw new ResearchLabTableMissingError()
    }
    throw new Error(batchError?.message || "Could not create import batch.")
  }

  const batchId = batch.id as string
  let imported = 0
  const insertErrors: ResearchImportError[] = [...normalizeErrors]

  for (let i = 0; i < importable.length; i += INSERT_BATCH_SIZE) {
    const chunk = importable.slice(i, i + INSERT_BATCH_SIZE)
    const payload = chunk.map((trade) =>
      toTradeInsertPayload(trade, userId, strategy, batchId),
    )

    const { error: insertError } = await supabase.from("trades").insert(payload)

    if (insertError) {
      if (/duplicate key|unique constraint/i.test(insertError.message)) {
        imported += 0
        insertErrors.push({
          row: 0,
          message: `Batch insert conflict: ${insertError.message}`,
        })
        continue
      }
      await supabase
        .from("research_import_batches")
        .update({
          status: "failed",
          error_count: insertErrors.length + chunk.length,
          errors: insertErrors,
          completed_at: new Date().toISOString(),
        })
        .eq("id", batchId)

      throw new Error(insertError.message)
    }

    imported += chunk.length
  }

  const skipped = parsed.rows.length - imported - normalizeErrors.length

  await supabase
    .from("research_import_batches")
    .update({
      imported_count: imported,
      skipped_count: Math.max(0, skipped),
      error_count: insertErrors.length,
      errors: insertErrors,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", batchId)

  return {
    batchId,
    imported,
    skipped: Math.max(0, trades.length - imported),
    errors: insertErrors,
    preview,
  }
}
