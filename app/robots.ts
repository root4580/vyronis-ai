import type { MetadataRoute } from "next"
import { getCanonicalSiteUrl } from "@/lib/site-url"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getCanonicalSiteUrl()

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog", "/blog/", "/auth/login", "/auth/sign-up"],
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
