import type { MetadataRoute } from "next"
import { APP_PRODUCTION_URL } from "@/lib/branding"

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  (process.env.NODE_ENV === "production" ? APP_PRODUCTION_URL : "http://localhost:3000")

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/auth/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/auth/sign-up`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ]
}
