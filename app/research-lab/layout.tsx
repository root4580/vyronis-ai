"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AuthLoadingState } from "@/components/auth/auth-loading-state"
import { APP_HOME_PATH } from "@/lib/branding"
import { fetchResearchLabEnabled } from "@/lib/research/api-client"

export default function ResearchLabLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "ready" | "blocked">("loading")

  useEffect(() => {
    let cancelled = false

    async function checkAccess() {
      try {
        const enabled = await fetchResearchLabEnabled()
        if (cancelled) return
        if (!enabled) {
          setStatus("blocked")
          router.replace(APP_HOME_PATH)
          return
        }
        setStatus("ready")
      } catch {
        if (!cancelled) {
          setStatus("blocked")
          router.replace(APP_HOME_PATH)
        }
      }
    }

    void checkAccess()

    return () => {
      cancelled = true
    }
  }, [router])

  if (status === "loading") {
    return <AuthLoadingState title="Research Lab" subtitle="Checking access…" />
  }

  if (status === "blocked") {
    return null
  }

  return children
}
