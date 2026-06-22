import { NextResponse, type NextRequest } from "next/server"

/** Server redirect only — session is established on /auth/confirm (mobile-safe). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const authError = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")
  const type = searchParams.get("type")

  if (authError) {
    const reason = errorDescription?.toLowerCase().includes("expired") ? "expired" : authError
    return NextResponse.redirect(`${origin}/auth/error?reason=${encodeURIComponent(reason)}`)
  }

  if (type === "recovery") {
    const query = searchParams.toString()
    return NextResponse.redirect(`${origin}/auth/reset-password${query ? `?${query}` : ""}`)
  }

  const hasAuthParams = searchParams.has("code") || searchParams.has("token_hash")
  if (hasAuthParams) {
    return NextResponse.redirect(`${origin}/auth/confirm?${searchParams.toString()}`)
  }

  return NextResponse.redirect(`${origin}/auth/error?reason=missing_params`)
}
