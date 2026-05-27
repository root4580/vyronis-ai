/**
 * App routes that require an authenticated Supabase session.
 * `/` hosts dashboard + journal tabs; `/analytics` is the standalone analytics page.
 */
export const PROTECTED_PATHS = ["/", "/analytics", "/strategy", "/profile"] as const

export const AUTH_ENTRY_PATHS = ["/auth/login", "/auth/sign-up", "/auth/forgot-password"] as const

export const AUTH_PUBLIC_PATHS = [
  ...AUTH_ENTRY_PATHS,
  "/auth/reset-password",
  "/auth/callback",
  "/auth/error",
] as const

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (path) =>
      pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)),
  )
}

export function isAuthEntryPath(pathname: string): boolean {
  return AUTH_ENTRY_PATHS.includes(pathname as (typeof AUTH_ENTRY_PATHS)[number])
}

/** Prevent open redirects — only allow same-app relative paths. */
export function sanitizeRedirectPath(
  path: string | null | undefined,
  fallback = "/",
): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return fallback
  }

  if (path.includes("\\") || path.includes(":")) {
    return fallback
  }

  return path
}
