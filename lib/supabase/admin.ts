import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { getPublicEnv, getServiceRoleKey } from "@/lib/env"

function supabaseProjectRefFromUrl(url: string): string | null {
  return url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null
}

function supabaseProjectRefFromJwt(key: string): string | null {
  try {
    const payload = key.split(".")[1]
    if (!payload) return null
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      ref?: string
    }
    return json.ref ?? null
  } catch {
    return null
  }
}

/** Server-only Supabase client (bypasses RLS). Use only in trusted API routes. */
export function createServiceRoleClient() {
  const { supabaseUrl } = getPublicEnv()
  const serviceRoleKey = getServiceRoleKey()
  const urlRef = supabaseProjectRefFromUrl(supabaseUrl)
  const keyRef = supabaseProjectRefFromJwt(serviceRoleKey)
  if (urlRef && keyRef && urlRef !== keyRef) {
    throw new Error(
      `Supabase project mismatch: NEXT_PUBLIC_SUPABASE_URL is "${urlRef}" but the service role key is for "${keyRef}". In Vercel, set SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) from the same project as your anon key, then redeploy.`,
    )
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
