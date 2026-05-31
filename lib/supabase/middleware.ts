import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { APP_HOME_PATH, APP_PRODUCTION_URL } from "@/lib/branding"
import {
  isAuthEntryPath,
  isProtectedPath,
  isPublicMarketingPath,
  sanitizeRedirectPath,
} from "@/lib/auth-routes"
import { assertProductionEnv, getPublicEnv } from "@/lib/env"

export async function updateSession(request: NextRequest) {
  assertProductionEnv()

  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? ""
  if (
    process.env.VERCEL_ENV === "production" &&
    host.endsWith(".vercel.app")
  ) {
    const target = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      APP_PRODUCTION_URL,
    )
    return NextResponse.redirect(target, 308)
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const { supabaseUrl, supabaseAnonKey } = getPublicEnv()
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  if (user && isPublicMarketingPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = APP_HOME_PATH
    return NextResponse.redirect(url)
  }

  if (!user && isProtectedPath(pathname)) {
    const returnPath = `${pathname}${request.nextUrl.search}`
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.search = ""
    url.searchParams.set("next", sanitizeRedirectPath(returnPath, APP_HOME_PATH))
    return NextResponse.redirect(url)
  }

  if (user && isAuthEntryPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = APP_HOME_PATH
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
