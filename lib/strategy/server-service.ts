import type { SupabaseClient } from "@supabase/supabase-js"
import {
  normalizeStrategyPlaybookInput,
  normalizeStrategyPlaybookRecord,
} from "@/lib/strategy/default-playbook"
import { createVyronisStrategyPlaybookInput } from "@/lib/strategy/vyronis-strategy-playbook"
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

export async function ensureDefaultStrategyPlaybook(
  supabase: SupabaseClient,
  userId: string,
): Promise<StrategyPlaybookRecord | null> {
  const vyronisInput = createVyronisStrategyPlaybookInput()
  const existingVyronis = await getStrategyPlaybookByName(
    supabase,
    userId,
    vyronisInput.strategy_name,
  )
  if (existingVyronis) {
    return existingVyronis.is_default
      ? existingVyronis
      : (await getDefaultStrategyPlaybook(supabase, userId)) || existingVyronis
  }

  const existingDefault = await getDefaultStrategyPlaybook(supabase, userId)
  if (existingDefault) {
    try {
      return await createStrategyPlaybook(supabase, userId, {
        ...vyronisInput,
        is_default: false,
      })
    } catch {
      return existingDefault
    }
  }

  try {
    return await createStrategyPlaybook(supabase, userId, vyronisInput)
  } catch {
    return null
  }
}

export async function listStrategyPlaybooks(
  supabase: SupabaseClient,
  userId: string,
): Promise<StrategyPlaybookRecord[]> {
  await ensureDefaultStrategyPlaybook(supabase, userId)

  const { data, error } = await supabase
    .from("strategy_playbooks")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  throwIfMissing(error)
  if (error) throw new Error(error.message)
  return (data || []).map((row) => rowToRecord(row as Record<string, unknown>))
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
