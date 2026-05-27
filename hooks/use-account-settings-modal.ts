"use client"

import { useCallback, useEffect, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { useToast } from "@/hooks/use-toast"
import {
  DEFAULT_USER_SETTINGS,
  normalizeUserSettings,
  type UserSettingsForm,
} from "@/lib/user-settings"

export function useAccountSettingsModal(
  supabase: SupabaseClient,
  userId: string | undefined,
) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState<UserSettingsForm>(DEFAULT_USER_SETTINGS)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!userId) return

    let cancelled = false

    async function loadSettings() {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()

      if (cancelled) return

      if (data && !error) {
        setForm(normalizeUserSettings(data))
      }

      setIsLoaded(true)
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [supabase, userId])

  const openSettings = useCallback(() => setIsOpen(true), [])
  const closeSettings = useCallback(() => setIsOpen(false), [])

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault()
    if (!userId) return

    setIsSaving(true)

    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        starting_balance: form.starting_balance,
        daily_drawdown_limit: form.daily_drawdown_limit,
        max_risk_per_trade: form.max_risk_per_trade,
        max_trades_per_day: form.max_trades_per_day,
        prop_firm_size: form.prop_firm_size,
        profit_target: form.profit_target,
        preferred_session: form.preferred_session,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

    setIsSaving(false)

    if (error) {
      toast({
        title: "Could not save settings",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Settings saved",
      description: "Your account preferences were updated.",
    })
    setIsOpen(false)
  }

  return {
    isOpen,
    openSettings,
    closeSettings,
    form,
    setForm,
    isSaving,
    isLoaded,
    saveSettings,
  }
}
