import type { MetadataRoute } from "next"
import { APP_PRODUCTION_URL } from "@/lib/branding"

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  (process.env.NODE_ENV === "production" ? APP_PRODUCTION_URL : "http://localhost:3000")

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/auth/login", "/auth/sign-up"],
        disallow: [
          "/hq",
          "/hq/",
          "/analytics",
          "/strategy",
          "/profile",
          "/research-lab",
          "/war-room",
          "/strategy-brain",
          "/evolution",
          "/journal",
          "/api/",
          "/auth/callback",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
