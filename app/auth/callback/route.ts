import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js"
import { sanitizeRedirectPath } from "@/lib/auth-routes"
import { getPublicEnv } from "@/lib/env"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import { DEFAULT_DASHBOARD_PREFERENCES } from "@/lib/user-preferences"

const EMAIL_VERIFICATION_TYPES = new Set<EmailOtpType>([
  "signup",
  "email",
  "magiclink",
  "invite",
])

function authErrorRedirect(origin: string, reason: string) {
  return NextResponse.redirect(`${origin}/auth/error?reason=${encodeURIComponent(reason)}`)
}

async function bootstrapNewUser(supabase: SupabaseClient, userId: string) {
  await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      ...DEFAULT_USER_SETTINGS,
      dashboard_preferences: DEFAULT_DASHBOARD_PREFERENCES,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  )

  await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  )
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const authError = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")
  const next =
    type === "recovery"
      ? sanitizeRedirectPath(searchParams.get("next"), "/auth/reset-password")
      : sanitizeRedirectPath(searchParams.get("next"))

  if (authError) {
    const reason = errorDescription?.toLowerCase().includes("expired") ? "expired" : authError
    return authErrorRedirect(origin, reason)
  }

  if (type === "recovery" && (tokenHash || code)) {
    const query = searchParams.toString()
    return NextResponse.redirect(`${origin}/auth/reset-password${query ? `?${query}` : ""}`)
  }

  const { supabaseUrl, supabaseAnonKey } = getPublicEnv()
  let response = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  let userId: string | null = null

  if (tokenHash && type && EMAIL_VERIFICATION_TYPES.has(type as EmailOtpType)) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    })
    if (error || !data.user) {
      return authErrorRedirect(origin, "exchange_failed")
    }
    userId = data.user.id
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data.user) {
      return authErrorRedirect(origin, "exchange_failed")
    }
    userId = data.user.id
  } else {
    return authErrorRedirect(origin, "missing_params")
  }

  await bootstrapNewUser(supabase, userId)
  return response
}
