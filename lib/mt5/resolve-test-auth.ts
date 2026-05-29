import type { NextRequest } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { getPublicEnv, getServiceRoleKey } from "@/lib/env"
import {
  Mt5WebhookError,
  resolveUserByMt5ApiKey,
  type Mt5WebhookUserContext,
} from "@/lib/mt5/webhook-server-service"

export type Mt5TestAuthMode = "api_key" | "session" | "bearer"

export type Mt5TestAuthResult = {
  supabase: SupabaseClient
  userCtx: Mt5WebhookUserContext
  mode: Mt5TestAuthMode
}

function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3
}

export function tryGetServiceRoleClient(): SupabaseClient | null {
  try {
    getServiceRoleKey()
    return createServiceRoleClient()
  } catch {
    return null
  }
}

export async function resolveMt5TestAuth(
  request: NextRequest,
): Promise<Mt5TestAuthResult> {
  const mt5ApiKey = request.headers.get("x-api-key")?.trim()
  if (mt5ApiKey) {
    const admin = tryGetServiceRoleClient()
    if (!admin) {
      throw new Mt5WebhookError(
        "X-API-Key requires SUPABASE_SECRET_KEY in .env.local (Supabase Dashboard → API Keys → Secret).",
        503,
      )
    }
    const userCtx = await resolveUserByMt5ApiKey(admin, mt5ApiKey)
    return { supabase: admin, userCtx, mode: "api_key" }
  }

  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim()

  let supabase: SupabaseClient
  if (bearer && looksLikeJwt(bearer)) {
    const { supabaseUrl, supabaseAnonKey } = getPublicEnv()
    supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    })
  } else {
    supabase = await createClient()
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Mt5WebhookError(
      "Sign in to the dashboard (session cookie), send Authorization: Bearer <access_token>, or X-API-Key with SUPABASE_SECRET_KEY configured.",
      401,
    )
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("max_risk_per_trade")
    .eq("user_id", user.id)
    .maybeSingle()

  return {
    supabase,
    userCtx: {
      user_id: user.id,
      max_risk_per_trade: settings?.max_risk_per_trade ?? 1,
    },
    mode: bearer && looksLikeJwt(bearer) ? "bearer" : "session",
  }
}

export function pickIngestClient(
  sessionClient: SupabaseClient,
): SupabaseClient {
  return tryGetServiceRoleClient() ?? sessionClient
}
