import type { Metadata } from "next"
import { Suspense } from "react"
import { AuthLoadingState } from "@/components/auth/auth-loading-state"

export const metadata: Metadata = {
  title: "Sign In",
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<AuthLoadingState title="Sign In" subtitle="Loading…" />}>
      {children}
    </Suspense>
  )
}
