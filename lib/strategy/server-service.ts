import type { SupabaseClient } from "@supabase/supabase-js"
import {
  normalizeStrategyPlaybookInput,
  normalizeStrategyPlaybookRecord,
} from "@/lib/strategy/default-playbook"
import {
  pickKeeperPlaybook,
  reassignCoachSessionsToPlaybook,
  shouldConsolidatePlaybooks,
} from "@/lib/strategy/consolidate-playbooks"
import {
  createVyronisStrategyPlaybookInput,
  VYRONIS_STRATEGY_NAME,
} from "@/lib/strategy/vyronis-strategy-playbook"
import type { StrategyPlaybookInput, StrategyPlaybookRecord } from "@/lib/strategy/types"

export class StrategyPlaybookTableMissingError extends Error {
  constructor() {
    super("Run supabase/strategy-playbooks-migration.sql to enable Strategy Playbooks.")
    this.name = "StrategyPlaybookTableMissingError"
  }
}

function throwIfMissing(error: { message?: string; code?: string } | null) {
  if (!error) return
  if (error.code === "42P01" || error.message?.includes("strategy_playbooks")) {
    throw new StrategyPlaybookTableMissingError()
  }
}

function rowToRecord(row: Record<string, unknown>): StrategyPlaybookRecord {
  return normalizeStrategyPlaybookRecord(row)
}

async function listStrategyPlaybooksRaw(
  supabase: SupabaseClient,
  userId: string,
): Promise<StrategyPlaybookRecord[]> {
  const { data, error } = await supabase
    .from("strategy_playbooks")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  throwIfMissing(error)
  if (error) throw new Error(error.message)
  return (data || []).map((row) => rowToRecord(row as Record<string, unknown>))
}

/** Merge duplicate playbooks into one canonical Top-Down AOI strategy. */
export async function consolidateStrategyPlaybooks(
  supabase: SupabaseClient,
  userId: string,
): Promise<StrategyPlaybookRecord | null> {
  const playbooks = await listStrategyPlaybooksRaw(supabase, userId)
  const canonical = createVyronisStrategyPlaybookInput()

  if (!shouldConsolidatePlaybooks(playbooks)) {
    if (playbooks.length === 1) {
      const only = playbooks[0]
      if (!only.is_default || only.strategy_name !== VYRONIS_STRATEGY_NAME) {
        return updateStrategyPlaybook(supabase, userId, only.id, {
          ...canonical,
          is_default: true,
        })
      }
    }
    return playbooks[0] ?? null
  }

  const keeper = pickKeeperPlaybook(playbooks)
  const deleteIds = playbooks.filter((p) => p.id !== keeper.id).map((p) => p.id)

  const merged = await updateStrategyPlaybook(supabase, userId, keeper.id, {
    ...canonical,
    is_default: true,
  })

  await reassignCoachSessionsToPlaybook(
    supabase,
    userId,
    deleteIds,
    merged.id,
    VYRONIS_STRATEGY_NAME,
  )

  for (const id of deleteIds) {
    await deleteStrategyPlaybook(supabase, userId, id)
  }

  return merged
}

export async function ensureDefaultStrategyPlaybook(
  supabase: SupabaseClient,
  userId: string,
): Promise<StrategyPlaybookRecord | null> {
  const rows = await listStrategyPlaybooksRaw(supabase, userId)
  if (rows.length > 0) {
    if (shouldConsolidatePlaybooks(rows)) {
      return consolidateStrategyPlaybooks(supabase, userId)
    }
    return getDefaultStrategyPlaybook(supabase, userId) ?? rows[0]
  }

  try {
    return await createStrategyPlaybook(supabase, userId, createVyronisStrategyPlaybookInput())
  } catch {
    return null
  }
}

export async function listStrategyPlaybooks(
  supabase: SupabaseClient,
  userId: string,
): Promise<StrategyPlaybookRecord[]> {
  await ensureDefaultStrategyPlaybook(supabase, userId)
  const rows = await listStrategyPlaybooksRaw(supabase, userId)
  if (shouldConsolidatePlaybooks(rows)) {
    await consolidateStrategyPlaybooks(supabase, userId)
    return listStrategyPlaybooksRaw(supabase, userId)
  }
  return rows
}

export async function getStrategyPlaybook(
  supabase: SupabaseClient,
  userId: string,
  playbookId: string,
): Promise<StrategyPlaybookRecord | null> {
  const { data, error } = await supabase
    .from("strategy_playbooks")
    .select("*")
    .eq("user_id", userId)
    .eq("id", playbookId)
    .maybeSingle()

  throwIfMissing(error)
  if (error) return null
  return data ? rowToRecord(data as Record<string, unknown>) : null
}

export async function getDefaultStrategyPlaybook(
  supabase: SupabaseClient,
  userId: string,
): Promise<StrategyPlaybookRecord | null> {
  const { data, error } = await supabase
    .from("strategy_playbooks")
    .select("*")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle()

  throwIfMissing(error)
  if (error) return null
  if (data) return rowToRecord(data as Record<string, unknown>)

  const { data: latest, error: latestError } = await supabase
    .from("strategy_playbooks")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  throwIfMissing(latestError)
  if (latestError || !latest) return null
  return rowToRecord(latest as Record<string, unknown>)
}

export async function getStrategyPlaybookByName(
  supabase: SupabaseClient,
  userId: string,
  strategyName: string,
): Promise<StrategyPlaybookRecord | null> {
  const { data, error } = await supabase
    .from("strategy_playbooks")
    .select("*")
    .eq("user_id", userId)
    .ilike("strategy_name", strategyName)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  throwIfMissing(error)
  if (error) return null
  return data ? rowToRecord(data as Record<string, unknown>) : null
}

async function clearDefaultPlaybook(supabase: SupabaseClient, userId: string) {
  await supabase
    .from("strategy_playbooks")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_default", true)
}

export async function createStrategyPlaybook(
  supabase: SupabaseClient,
  userId: string,
  input: Partial<StrategyPlaybookInput>,
): Promise<StrategyPlaybookRecord> {
  const normalized = normalizeStrategyPlaybookInput(input)

  if (normalized.is_default) {
    await clearDefaultPlaybook(supabase, userId)
  }

  const { data, error } = await supabase
    .from("strategy_playbooks")
    .insert({
      user_id: userId,
      strategy_name: normalized.strategy_name,
      description: normalized.description,
      bias_rules: normalized.bias_rules,
      entry_rules: normalized.entry_rules,
      invalidation_rules: normalized.invalidation_rules,
      confluence_rules: normalized.confluence_rules,
      forbidden_conditions: normalized.forbidden_conditions,
      rr_minimum: normalized.rr_minimum,
      example_notes: normalized.example_notes,
      is_default: normalized.is_default,
    })
    .select("*")
    .single()

  throwIfMissing(error)
  if (error || !data) throw new Error(error?.message || "Could not create strategy playbook")
  return rowToRecord(data as Record<string, unknown>)
}

export async function updateStrategyPlaybook(
  supabase: SupabaseClient,
  userId: string,
  playbookId: string,
  input: Partial<StrategyPlaybookInput>,
): Promise<StrategyPlaybookRecord> {
  const existing = await getStrategyPlaybook(supabase, userId, playbookId)
  if (!existing) throw new Error("Strategy playbook not found")

  const normalized = normalizeStrategyPlaybookInput(
    {
      ...existing,
      ...input,
      strategy_name: input.strategy_name ?? existing.strategy_name,
    },
    existing.strategy_name,
  )

  if (normalized.is_default) {
    await clearDefaultPlaybook(supabase, userId)
  }

  const { data, error } = await supabase
    .from("strategy_playbooks")
    .update({
      strategy_name: normalized.strategy_name,
      description: normalized.description,
      bias_rules: normalized.bias_rules,
      entry_rules: normalized.entry_rules,
      invalidation_rules: normalized.invalidation_rules,
      confluence_rules: normalized.confluence_rules,
      forbidden_conditions: normalized.forbidden_conditions,
      rr_minimum: normalized.rr_minimum,
      example_notes: normalized.example_notes,
      is_default: normalized.is_default,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", playbookId)
    .select("*")
    .single()

  throwIfMissing(error)
  if (error || !data) throw new Error(error?.message || "Could not update strategy playbook")
  return rowToRecord(data as Record<string, unknown>)
}

export async function deleteStrategyPlaybook(
  supabase: SupabaseClient,
  userId: string,
  playbookId: string,
): Promise<void> {
  const { error } = await supabase
    .from("strategy_playbooks")
    .delete()
    .eq("user_id", userId)
    .eq("id", playbookId)

  throwIfMissing(error)
  if (error) throw new Error(error.message)
}

export async function resolveCoachPlaybook(
  supabase: SupabaseClient,
  userId: string,
  context: { strategy_playbook_id?: string | null; strategy_name?: string | null },
): Promise<StrategyPlaybookRecord | null> {
  if (context.strategy_playbook_id) {
    return getStrategyPlaybook(supabase, userId, context.strategy_playbook_id)
  }
  if (context.strategy_name) {
    const byName = await getStrategyPlaybookByName(supabase, userId, context.strategy_name)
    if (byName) return byName
  }
  return ensureDefaultStrategyPlaybook(supabase, userId)
}
