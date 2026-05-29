type PublicEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
  appUrl: string
}

function requireEnv(name: string, value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return trimmed
}

/** Client-safe Supabase + app URL — validated at module load in the browser. */
export function getPublicEnv(): PublicEnv {
  return {
    supabaseUrl: requireEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    supabaseAnonKey: requireEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    appUrl:
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL?.replace(/\/auth\/callback$/, "") ||
      "http://localhost:3000",
  }
}

/** Server-only AI keys — call from API routes, not client components. */
export function getServerAiEnv() {
  return {
    provider: process.env.AI_PROVIDER?.trim() || "heuristic",
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || "",
    chartVisionProvider: process.env.CHART_VISION_PROVIDER?.trim() || "openai",
  }
}

/** Server-only service role — webhook ingest only. Never import from client components. */
export function getServiceRoleKey(): string {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY_VYRONIS?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim()
  return requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SERVICE_ROLE_KEY_VYRONIS, or SUPABASE_SECRET_KEY",
    key,
  )
}

/** Canonical app URL for webhooks and redirects. */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "")
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/$/, "")}`
  }
  return (
    process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL?.replace(/\/auth\/callback$/, "") ||
    "http://localhost:3000"
  ).replace(/\/$/, "")
}

export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return

  const env = getPublicEnv()
  const appUrl = env.appUrl.trim()

  if (appUrl.startsWith("http://localhost")) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be your production URL in production (not localhost).",
    )
  }

  if (!appUrl.startsWith("https://")) {
    throw new Error("NEXT_PUBLIC_APP_URL must use https in production.")
  }
}
