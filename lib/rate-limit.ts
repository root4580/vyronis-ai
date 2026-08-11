import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

/**
 * Checks and increments a fixed-window rate-limit counter stored in Postgres
 * (see supabase/051-rate-limiting.sql). Must be called with a service-role
 * Supabase client — the underlying table has RLS enabled with no policies.
 *
 * Fails open: if the check itself errors (e.g. migration not run yet), real
 * traffic is not blocked — we log and allow the request through.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  opts: { maxRequests: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max_requests: opts.maxRequests,
    p_window_seconds: opts.windowSeconds,
  })

  if (error) {
    console.error("[rate-limit] check failed, failing open:", error.message)
    return { allowed: true, remaining: opts.maxRequests, retryAfterSeconds: 0 }
  }

  const row = Array.isArray(data) ? data[0] : data
  return {
    allowed: Boolean(row?.allowed ?? true),
    remaining: Number(row?.remaining ?? 0),
    retryAfterSeconds: Number(row?.retry_after_seconds ?? 1),
  }
}

/** Best-effort caller IP from standard proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]!.trim()
  const real = request.headers.get("x-real-ip")
  if (real) return real.trim()
  return "unknown"
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  )
}
