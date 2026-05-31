import type { Metadata } from "next"
import { Suspense } from "react"
import { AuthPageSuspenseFallback } from "@/components/auth/auth-page-frame"
import { MARKETING_DESCRIPTION } from "@/lib/branding"

export const metadata: Metadata = {
  title: "Create Account",
  description: MARKETING_DESCRIPTION,
  robots: { index: true, follow: true },
}

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<AuthPageSuspenseFallback />}>{children}</Suspense>
}
