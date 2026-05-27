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

export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return
  getPublicEnv()
}
