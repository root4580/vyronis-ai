import type { Metadata } from "next"
import {
  APP_PRODUCTION_URL,
  MARKETING_DESCRIPTION,
  MARKETING_KEYWORDS,
  MARKETING_TITLE,
} from "@/lib/branding"

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  (process.env.NODE_ENV === "production" ? APP_PRODUCTION_URL : "http://localhost:3000")

export const metadata: Metadata = {
  title: MARKETING_TITLE,
  description: MARKETING_DESCRIPTION,
  keywords: MARKETING_KEYWORDS,
  alternates: { canonical: appUrl },
  openGraph: {
    title: MARKETING_TITLE,
    description: MARKETING_DESCRIPTION,
    url: appUrl,
    siteName: "Vyronis",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: MARKETING_TITLE,
    description: MARKETING_DESCRIPTION,
  },
  robots: { index: true, follow: true },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return children
}
