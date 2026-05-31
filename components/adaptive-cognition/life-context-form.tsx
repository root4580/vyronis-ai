"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { LifeContextEntry } from "@/lib/adaptive-cognition/types"

type LifeContextFormProps = {
  onSaved?: () => void
}

function SliderField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] text-muted-foreground/80">{label}</span>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-cyan-glow"
      />
      <span className="text-[10px] tabular-nums text-cyan-glow/80">{value}/10</span>
    </label>
  )
}

export function LifeContextForm({ onSaved }: LifeContextFormProps) {
  const [sleepQuality, setSleepQuality] = useState(7)
  const [stress, setStress] = useState(4)
  const [workFatigue, setWorkFatigue] = useState(4)
  const [gymConsistency, setGymConsistency] = useState(6)
  const [emotionalState, setEmotionalState] = useState(6)
  const [focusLevel, setFocusLevel] = useState(7)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const entry: LifeContextEntry = {
      date: new Date().toISOString().slice(0, 10),
      sleepQuality,
      stress,
      workFatigue,
      gymConsistency,
      emotionalState,
      focusLevel,
      notes: notes.trim() || null,
    }
    try {
      const res = await fetch("/api/intelligence/adaptive-cognition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lifeContext: entry }),
      })
      if (!res.ok) throw new Error("Save failed")
      onSaved?.()
    } catch {
      setError("Could not save — run migration 021 if the table is missing.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
      <div>
        <p className="text-[11px] font-medium text-foreground/88">Life context (optional)</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
          Correlate sleep, stress, and focus with trading performance.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SliderField label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} />
        <SliderField label="Stress" value={stress} onChange={setStress} />
        <SliderField label="Work fatigue" value={workFatigue} onChange={setWorkFatigue} />
        <SliderField label="Gym / movement" value={gymConsistency} onChange={setGymConsistency} />
        <SliderField label="Emotional state" value={emotionalState} onChange={setEmotionalState} />
        <SliderField label="Focus level" value={focusLevel} onChange={setFocusLevel} />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional note…"
        rows={2}
        className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] text-foreground/90"
      />
      {error ? <p className="text-[10px] text-warning-muted/90">{error}</p> : null}
      <Button type="submit" size="sm" disabled={saving} className="h-8 text-xs">
        {saving ? "Saving…" : "Log today"}
      </Button>
    </form>
  )
}
