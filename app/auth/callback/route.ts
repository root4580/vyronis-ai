import { NextResponse, type NextRequest } from "next/server"
import { handleAuthCallback } from "@/lib/auth-callback-server"

/** Server-side PKCE / OTP exchange — Supabase recommended App Router pattern. */
export async function GET(request: NextRequest) {
  const result = await handleAuthCallback(request)

  if (!result.ok) {
    console.error("[auth/callback] verification failed", {
      method: result.method,
      supabaseError: result.supabaseError,
    })
  }

  const target = new URL(result.redirectPath, request.nextUrl.origin)
  return NextResponse.redirect(target)
}
