import { APP_PRODUCTION_URL } from "@/lib/branding"

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

function stripTrailingSlash(url: string): string {
  return url.trim().replace(/\/$/, "")
}

function isVercelPreviewOrDevHost(host: string): boolean {
  const h = host.toLowerCase()
  return h.startsWith("localhost") || h.includes("127.0.0.1") || h.endsWith(".vercel.app")
}

function safeUrlHost(url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

function baseUrlFromHostHeader(hostHeader: string | null): string | null {
  if (!hostHeader?.trim()) return null
  const host = hostHeader.split(",")[0]?.trim().split(":")[0]?.trim()
  if (!host || isVercelPreviewOrDevHost(host)) return null
  return `https://${host}`
}

function isVercelProduction(): boolean {
  return process.env.VERCEL_ENV === "production"
}

/** Production canonical host when env is not set (custom domain). */
export function getCanonicalProductionBaseUrl(): string {
  return stripTrailingSlash(APP_PRODUCTION_URL)
}

/**
 * Canonical app URL for webhooks, auth redirects, and metadata.
 * When the request is on a custom domain (e.g. vyronishq.com), use that host even if
 * NEXT_PUBLIC_APP_URL still points at a legacy *.vercel.app deployment.
 */
export function getAppBaseUrl(request?: Request): string {
  if (request) {
    const forwarded =
      request.headers.get("x-forwarded-host") || request.headers.get("host")
    const fromRequest = baseUrlFromHostHeader(forwarded)
    if (fromRequest) return fromRequest
  }

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  const envHost = fromEnv ? safeUrlHost(fromEnv) : null
  if (fromEnv && !(isVercelProduction() && envHost && isVercelPreviewOrDevHost(envHost))) {
    return stripTrailingSlash(fromEnv)
  }

  if (isVercelProduction() || (process.env.NODE_ENV === "production" && process.env.VERCEL)) {
    return getCanonicalProductionBaseUrl()
  }

  if (process.env.VERCEL_URL?.trim()) {
    return `https://${stripTrailingSlash(process.env.VERCEL_URL)}`
  }

  return stripTrailingSlash(
    process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL?.replace(/\/auth\/callback$/, "") ||
      "http://localhost:3000",
  )
}

/** Client-safe Supabase + app URL — validated at module load in the browser. */
export function getPublicEnv(): PublicEnv {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  const envHost = fromEnv ? safeUrlHost(fromEnv) : null
  const useEnvUrl =
    fromEnv &&
    !(process.env.NODE_ENV === "production" && envHost && isVercelPreviewOrDevHost(envHost))

  const appUrl = useEnvUrl
    ? stripTrailingSlash(fromEnv)
    : process.env.NODE_ENV === "production"
      ? getCanonicalProductionBaseUrl()
      : process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL?.replace(/\/auth\/callback$/, "") ||
        "http://localhost:3000"

  return {
    supabaseUrl: requireEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    supabaseAnonKey: requireEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    appUrl: stripTrailingSlash(appUrl),
  }
}

/** Server-only AI keys — call from API routes, not client components. */
export function getServerAiEnv() {
  return {
    provider: process.env.AI_PROVIDER?.trim() || "heuristic",
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || "",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || "",
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || "",
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

export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return

  const appUrl = getPublicEnv().appUrl.trim()

  if (appUrl.startsWith("http://localhost")) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be your production URL in production (not localhost).",
    )
  }

  if (isVercelPreviewOrDevHost(new URL(appUrl).host)) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be https://vyronishq.com in production (not a *.vercel.app URL).",
    )
  }

  if (!appUrl.startsWith("https://")) {
    throw new Error("NEXT_PUBLIC_APP_URL must use https in production.")
  }
}
