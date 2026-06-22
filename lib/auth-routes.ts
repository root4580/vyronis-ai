import { APP_HOME_PATH } from "@/lib/branding"

/**
 * Authenticated app routes — require Supabase session (middleware).
 * Public marketing lives at `/`; product shell at `/hq`.
 */
export const PROTECTED_PATHS = [
  APP_HOME_PATH,
  "/analytics",
  "/strategy",
  "/profile",
  "/research-lab",
  "/war-room",
  "/trade-planner",
  "/strategy-brain",
  "/evolution",
  "/journal",
] as const

export const PUBLIC_MARKETING_PATHS = ["/"] as const

export const AUTH_ENTRY_PATHS = [
  "/auth/login",
  "/auth/sign-up",
  "/auth/forgot-password",
  "/auth/verify-email",
] as const

export const AUTH_PUBLIC_PATHS = [
  ...AUTH_ENTRY_PATHS,
  "/auth/confirm",
  "/auth/reset-password",
  "/auth/callback",
  "/auth/error",
] as const

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

export function isAuthEntryPath(pathname: string): boolean {
  return AUTH_ENTRY_PATHS.includes(pathname as (typeof AUTH_ENTRY_PATHS)[number])
}

export function isPublicMarketingPath(pathname: string): boolean {
  return PUBLIC_MARKETING_PATHS.includes(pathname as (typeof PUBLIC_MARKETING_PATHS)[number])
}

/** Prevent open redirects — only allow same-app relative paths. */
export function sanitizeRedirectPath(
  path: string | null | undefined,
  fallback = APP_HOME_PATH,
): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return fallback
  }

  if (path.includes("\\") || path.includes(":")) {
    return fallback
  }

  if (isPublicMarketingPath(path)) {
    return APP_HOME_PATH
  }

  return path
}
