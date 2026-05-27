import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isAuthEntryPath, isProtectedPath, sanitizeRedirectPath } from "@/lib/auth-routes"
import { getPublicEnv } from "@/lib/env"

export async function updateSession(request: NextRequest) {
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

  if (!user && isProtectedPath(pathname)) {
    const returnPath = `${pathname}${request.nextUrl.search}`
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.search = ""
    url.searchParams.set("next", sanitizeRedirectPath(returnPath, "/"))
    return NextResponse.redirect(url)
  }

  if (user && isAuthEntryPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
