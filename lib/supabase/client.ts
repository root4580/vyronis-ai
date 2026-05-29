"use client"

import { createBrowserClient } from "@supabase/ssr"
import { getPublicEnv } from "@/lib/env"

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (client) return client

  const { supabaseUrl, supabaseAnonKey } = getPublicEnv()
  client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
    },
  })

  return client
}
