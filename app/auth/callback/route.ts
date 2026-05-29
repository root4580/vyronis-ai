import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { sanitizeRedirectPath } from "@/lib/auth-routes"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import { DEFAULT_DASHBOARD_PREFERENCES } from "@/lib/user-preferences"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const type = searchParams.get("type")
  const next =
    type === "recovery"
      ? sanitizeRedirectPath(searchParams.get("next"), "/auth/reset-password")
      : sanitizeRedirectPath(searchParams.get("next"))
  const authError = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  if (authError) {
    const reason =
      errorDescription?.toLowerCase().includes("expired") ? "expired" : authError
    return NextResponse.redirect(`${origin}/auth/error?reason=${encodeURIComponent(reason)}`)
  }

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      await supabase.from("user_settings").upsert(
        {
          user_id: data.user.id,
          ...DEFAULT_USER_SETTINGS,
          dashboard_preferences: DEFAULT_DASHBOARD_PREFERENCES,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id", ignoreDuplicates: true },
      )

      await supabase.from("user_profiles").upsert(
        {
          user_id: data.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id", ignoreDuplicates: true },
      )

      return NextResponse.redirect(`${origin}${next}`)
    }

    return NextResponse.redirect(`${origin}/auth/error?reason=exchange_failed`)
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
