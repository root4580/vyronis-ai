import type { Metadata } from "next"
import { MARKETING_DESCRIPTION, MARKETING_TITLE } from "@/lib/branding"
import { canonicalPath } from "@/lib/site-url"

export const metadata: Metadata = {
  title: "Journal — Trading Discipline & AI Scoring",
  description: MARKETING_DESCRIPTION,
  alternates: { canonical: canonicalPath("/blog") },
  openGraph: {
    title: `Journal | ${MARKETING_TITLE}`,
    description: MARKETING_DESCRIPTION,
    url: canonicalPath("/blog"),
    type: "website",
  },
  robots: { index: true, follow: true },
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children
}
