import { APP_PRODUCTION_URL } from "@/lib/branding"

const LOCAL_DEV_URL = "http://localhost:3000"

/**
 * Canonical public site URL for SEO (metadata, sitemap, OG, JSON-LD).
 * Always uses the production custom domain — never the Vercel preview URL.
 */
export function getCanonicalSiteUrl(): string {
  if (process.env.NODE_ENV === "production") {
    return APP_PRODUCTION_URL
  }
  return LOCAL_DEV_URL
}

/** Runtime app URL (webhooks, emails) — may differ from canonical in staging. */
export function getRuntimeAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.NODE_ENV === "production" ? APP_PRODUCTION_URL : LOCAL_DEV_URL)
  )
}

export function canonicalPath(path: string): string {
  const base = getCanonicalSiteUrl().replace(/\/$/, "")
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${base}${normalized}`
}
