import { createServerClient } from "@supabase/ssr"
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { bootstrapNewUserRecords } from "@/lib/auth-bootstrap"
import { sanitizeRedirectPath } from "@/lib/auth-routes"
import { getPublicEnv } from "@/lib/env"

const EMAIL_VERIFICATION_TYPES: EmailOtpType[] = [
  "signup",
  "email",
  "magiclink",
  "invite",
]

export type AuthCallbackDiagnostics = {
  pathname: string
  hasCode: boolean
  hasTokenHash: boolean
  type: string | null
  hasError: boolean
  error: string | null
  errorDescription: string | null
  next: string | null
  redactedQuery: string
}

export type AuthCallbackFailureMethod =
  | "code"
  | "token_hash"
  | "missing"
  | "oauth_error"

export type AuthCallbackResult =
  | { ok: true; redirectPath: string }
  | {
      ok: false
      redirectPath: string
      supabaseError: string
      method: AuthCallbackFailureMethod
    }

function verificationTypeOrder(preferred?: string | null): EmailOtpType[] {
  const normalized = preferred?.trim().toLowerCase()
  if (!normalized) return EMAIL_VERIFICATION_TYPES

  const preferredType = EMAIL_VERIFICATION_TYPES.find((type) => type === normalized)
  if (!preferredType) return EMAIL_VERIFICATION_TYPES

  return [
    preferredType,
    ...EMAIL_VERIFICATION_TYPES.filter((type) => type !== preferredType),
  ]
}

export function buildAuthCallbackDiagnostics(request: NextRequest): AuthCallbackDiagnostics {
  const { searchParams, pathname } = request.nextUrl
  const redacted = new URLSearchParams(searchParams)

  if (redacted.has("code")) {
    redacted.set("code", `[len=${redacted.get("code")?.length ?? 0}]`)
  }
  if (redacted.has("token_hash")) {
    redacted.set("token_hash", `[len=${redacted.get("token_hash")?.length ?? 0}]`)
  }

  return {
    pathname,
    hasCode: searchParams.has("code"),
    hasTokenHash: searchParams.has("token_hash"),
    type: searchParams.get("type"),
    hasError: searchParams.has("error"),
    error: searchParams.get("error"),
    errorDescription: searchParams.get("error_description"),
    next: searchParams.get("next"),
    redactedQuery: redacted.toString(),
  }
}

async function createRouteHandlerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })
}

function authErrorRedirect(
  reason: string,
  detail: string,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams({
    reason,
    detail,
    ...extra,
  })
  return `/auth/error?${params.toString()}`
}

/**
 * Supabase-recommended Next.js App Router flow: exchange code / verify OTP on the server
 * so email links work on any device (no PKCE verifier in the signup browser required).
 */
export async function handleAuthCallback(request: NextRequest): Promise<AuthCallbackResult> {
  const diagnostics = buildAuthCallbackDiagnostics(request)
  console.info("[auth/callback] incoming", JSON.stringify(diagnostics))

  const { searchParams } = request.nextUrl
  const next = sanitizeRedirectPath(searchParams.get("next"))

  const oauthError = searchParams.get("error")
  if (oauthError) {
    const detail =
      searchParams.get("error_description")?.trim() ||
      oauthError ||
      "OAuth provider returned an error."
    console.error("[auth/callback] oauth error", detail)
    return {
      ok: false,
      redirectPath: authErrorRedirect(oauthError, detail, { method: "oauth_error" }),
      supabaseError: detail,
      method: "oauth_error",
    }
  }

  if (searchParams.get("type") === "recovery") {
    const supabase = await createRouteHandlerClient()
    const recoveryCode = searchParams.get("code")
    const recoveryHash = searchParams.get("token_hash")

    if (recoveryHash) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: recoveryHash,
        type: "recovery",
      })
      if (error) {
        console.error("[auth/callback] recovery verifyOtp failed", error.message)
        return {
          ok: false,
          redirectPath: authErrorRedirect("exchange_failed", error.message, {
            method: "token_hash",
            type: "recovery",
          }),
          supabaseError: error.message,
          method: "token_hash",
        }
      }
      return { ok: true, redirectPath: "/auth/reset-password" }
    }

    if (recoveryCode) {
      const { error } = await supabase.auth.exchangeCodeForSession(recoveryCode)
      if (error) {
        console.error("[auth/callback] recovery exchangeCodeForSession failed", error.message)
        const detail = error.message.toLowerCase().includes("pkce")
          ? `${error.message} Request a new reset email and open the latest link.`
          : error.message
        return {
          ok: false,
          redirectPath: authErrorRedirect("exchange_failed", detail, {
            method: "code",
            type: "recovery",
          }),
          supabaseError: detail,
          method: "code",
        }
      }
      return { ok: true, redirectPath: "/auth/reset-password" }
    }

    const query = searchParams.toString()
    return {
      ok: true,
      redirectPath: `/auth/reset-password${query ? `?${query}` : ""}`,
    }
  }

  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")

  if (!code && !tokenHash) {
    const detail = "Callback URL has no code or token_hash query parameter."
    console.error("[auth/callback] missing params", diagnostics.redactedQuery)
    return {
      ok: false,
      redirectPath: authErrorRedirect("missing_params", detail, { method: "missing" }),
      supabaseError: detail,
      method: "missing",
    }
  }

  const supabase = await createRouteHandlerClient()

  // Prefer token_hash for email links — no PKCE verifier required (works on any device).
  if (tokenHash) {
    console.info("[auth/callback] using verifyOtp", {
      tokenHashLength: tokenHash.length,
      type,
    })

    let lastError = "verifyOtp failed."
    for (const otpType of verificationTypeOrder(type)) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      })

      if (!error && data.session?.user) {
        await bootstrapNewUserRecords(supabase, data.session.user.id)
        console.info("[auth/callback] verifyOtp ok", { otpType })
        return { ok: true, redirectPath: next }
      }

      lastError = error?.message ?? lastError
      console.warn("[auth/callback] verifyOtp attempt failed", {
        otpType,
        message: error?.message,
        name: error?.name,
        status: error?.status,
      })

      const lower = lastError.toLowerCase()
      if (lower.includes("expired") || lower.includes("already been used")) {
        break
      }
    }

    console.error("[auth/callback] verifyOtp exhausted", lastError)
    return {
      ok: false,
      redirectPath: authErrorRedirect("exchange_failed", lastError, {
        method: "token_hash",
        type: type ?? "",
      }),
      supabaseError: lastError,
      method: "token_hash",
    }
  }

  if (code) {
    console.info("[auth/callback] using exchangeCodeForSession", {
      codeLength: code.length,
      type,
    })

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession failed", {
        message: error.message,
        name: error.name,
        status: error.status,
      })
      const detail = error.message.toLowerCase().includes("pkce")
        ? `${error.message} Request a new verification email and open the latest link.`
        : error.message
      return {
        ok: false,
        redirectPath: authErrorRedirect("exchange_failed", detail, {
          method: "code",
          type: type ?? "",
        }),
        supabaseError: detail,
        method: "code",
      }
    }

    if (data.session?.user) {
      await bootstrapNewUserRecords(supabase, data.session.user.id)
    }

    console.info("[auth/callback] exchangeCodeForSession ok", {
      userId: data.session?.user?.id ?? null,
    })
    return { ok: true, redirectPath: next }
  }

  const detail = "Callback URL has no code or token_hash query parameter."
  return {
    ok: false,
    redirectPath: authErrorRedirect("missing_params", detail, { method: "missing" }),
    supabaseError: detail,
    method: "missing",
  }
}
