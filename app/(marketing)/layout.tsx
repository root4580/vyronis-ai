import type { Metadata } from "next"
import {
  MARKETING_DESCRIPTION,
  MARKETING_KEYWORDS,
  MARKETING_TITLE,
} from "@/lib/branding"
import { getCanonicalSiteUrl } from "@/lib/site-url"

const siteUrl = getCanonicalSiteUrl()
const ogImageUrl = `${siteUrl}/og-image.png`

export const metadata: Metadata = {
  title: MARKETING_TITLE,
  description: MARKETING_DESCRIPTION,
  keywords: MARKETING_KEYWORDS,
  alternates: { canonical: siteUrl },
  openGraph: {
    title: MARKETING_TITLE,
    description: MARKETING_DESCRIPTION,
    url: siteUrl,
    siteName: "Vyronis",
    type: "website",
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "Vyronis — AI Trading Operating System",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: MARKETING_TITLE,
    description: MARKETING_DESCRIPTION,
    images: [ogImageUrl],
  },
  robots: { index: true, follow: true },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return children
}
