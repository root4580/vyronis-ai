"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchDailyJournalClose, saveDailyJournalClose } from "@/lib/daily-journal/api-client"
import type { DailyJournalEntry } from "@/lib/daily-journal/types"

type DailyJournalForm = {
  improveTomorrow: string
  rulesNextSession: string
  focusArea: string
}

const EMPTY_FORM: DailyJournalForm = {
  improveTomorrow: "",
  rulesNextSession: "",
  focusArea: "",
}

export function useDailyJournalClose(accountId: string | null | undefined) {
  const [form, setForm] = useState<DailyJournalForm>(EMPTY_FORM)
  const [entry, setEntry] = useState<DailyJournalEntry | null>(null)
  const [connected, setConnected] = useState(true)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    setError(null)
    try {
      const snapshot = await fetchDailyJournalClose({ accountId })
      setConnected(snapshot.connected)
      setSetupMessage(snapshot.setupMessage ?? null)
      setEntry(snapshot.entry)
      if (snapshot.entry) {
        setForm({
          improveTomorrow: snapshot.entry.improveTomorrow,
          rulesNextSession: snapshot.entry.rulesNextSession,
          focusArea: snapshot.entry.focusArea,
        })
        setSavedAt(snapshot.entry.updatedAt)
      } else {
        setForm(EMPTY_FORM)
        setSavedAt(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load daily close")
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    void reload()
  }, [reload])

  const save = useCallback(async () => {
    if (!accountId) return false
    setSaving(true)
    setError(null)
    try {
      const snapshot = await saveDailyJournalClose({
        accountId,
        improveTomorrow: form.improveTomorrow,
        rulesNextSession: form.rulesNextSession,
        focusArea: form.focusArea,
      })
      if (!snapshot.connected) {
        setSetupMessage(snapshot.setupMessage ?? "Daily journal unavailable.")
        return false
      }
      setEntry(snapshot.entry)
      setSavedAt(snapshot.entry?.updatedAt ?? new Date().toISOString())
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save daily close")
      return false
    } finally {
      setSaving(false)
    }
  }, [accountId, form])

  const isComplete =
    Boolean(form.improveTomorrow.trim()) &&
    Boolean(form.rulesNextSession.trim()) &&
    Boolean(form.focusArea.trim())

  return {
    form,
    setForm,
    entry,
    connected,
    setupMessage,
    loading,
    saving,
    error,
    savedAt,
    isComplete,
    reload,
    save,
  }
}
