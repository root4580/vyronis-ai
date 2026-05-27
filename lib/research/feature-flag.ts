import type { SupabaseClient } from "@supabase/supabase-js"

export class ResearchLabDisabledError extends Error {
  constructor() {
    super("Research Lab is not enabled for this account.")
    this.name = "ResearchLabDisabledError"
  }
}

export class ResearchLabTableMissingError extends Error {
  constructor(message = "Run supabase/010-research-lab-foundation.sql in Supabase first.") {
    super(message)
    this.name = "ResearchLabTableMissingError"
  }
}

function isMissingResearchColumnError(message: string): boolean {
  return /research_lab_enabled|column .* does not exist|schema cache/i.test(message)
}

export async function isResearchLabEnabled(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("research_lab_enabled")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    if (isMissingResearchColumnError(error.message)) {
      return false
    }
    throw new Error(error.message)
  }

  return Boolean(data?.research_lab_enabled)
}

export async function assertResearchLabEnabled(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const enabled = await isResearchLabEnabled(supabase, userId)
  if (!enabled) {
    throw new ResearchLabDisabledError()
  }
}

export function isResearchLabInfrastructureError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const message = "message" in error ? String(error.message) : ""
  const code = "code" in error ? String(error.code) : ""
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /research_strategies|research_import_batches|research_lab_enabled/i.test(message)
  )
}
