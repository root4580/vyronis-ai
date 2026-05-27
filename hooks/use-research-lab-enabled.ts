"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function useResearchLabEnabled() {
  const supabase = useMemo(() => createClient(), [])
  const [enabled, setEnabled] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          if (!cancelled) {
            setEnabled(false)
            setIsReady(true)
          }
          return
        }

        const { data, error } = await supabase
          .from("user_settings")
          .select("research_lab_enabled")
          .eq("user_id", user.id)
          .maybeSingle()

        if (!cancelled) {
          if (error && /research_lab_enabled|column .* does not exist/i.test(error.message)) {
            setEnabled(false)
          } else {
            setEnabled(Boolean(data?.research_lab_enabled))
          }
          setIsReady(true)
        }
      } catch {
        if (!cancelled) {
          setEnabled(false)
          setIsReady(true)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [supabase])

  return { enabled, isReady }
}
