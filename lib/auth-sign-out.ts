import type { SupabaseClient } from "@supabase/supabase-js"

export const SIGN_OUT_TIMEOUT_MS = 3000
export const LOGIN_PATH = "/auth/login"

export type SignOutResult = {
  error: Error | null
  timedOut: boolean
}

/** Clears the browser session immediately without waiting on the server. */
export async function clearLocalAuthSession(supabase: SupabaseClient) {
  try {
    await supabase.auth.signOut({ scope: "local" })
  } catch {
    // Continue redirect even if local cleanup fails.
  }
}

/** Revokes the server session with a timeout fallback. */
export async function signOutWithTimeout(
  supabase: SupabaseClient,
  timeoutMs = SIGN_OUT_TIMEOUT_MS,
): Promise<SignOutResult> {
  let timedOut = false

  const timeoutPromise = new Promise<SignOutResult>((resolve) => {
    setTimeout(() => {
      timedOut = true
      resolve({ error: null, timedOut: true })
    }, timeoutMs)
  })

  const signOutPromise = supabase.auth
    .signOut()
    .then(({ error }) => ({
      error: error ? new Error(error.message) : null,
      timedOut: false,
    }))
    .catch((error: unknown) => ({
      error: error instanceof Error ? error : new Error("Sign out failed"),
      timedOut: false,
    }))

  const result = await Promise.race([signOutPromise, timeoutPromise])

  if (result.timedOut || timedOut) {
    await clearLocalAuthSession(supabase)
    return { error: null, timedOut: true }
  }

  return result
}

export function redirectToLogin() {
  if (typeof window === "undefined") return
  window.location.replace(LOGIN_PATH)
}

export async function performFastSignOut(
  supabase: SupabaseClient,
  options?: {
    onBackgroundComplete?: (result: SignOutResult) => void
  },
) {
  await clearLocalAuthSession(supabase)

  void signOutWithTimeout(supabase).then((result) => {
    options?.onBackgroundComplete?.(result)
  })
}
