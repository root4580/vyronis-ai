import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { getPublicEnv, getServiceRoleKey } from "@/lib/env"

/** Server-only Supabase client (bypasses RLS). Use only in trusted API routes. */
export function createServiceRoleClient() {
  const { supabaseUrl } = getPublicEnv()
  const serviceRoleKey = getServiceRoleKey()

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
