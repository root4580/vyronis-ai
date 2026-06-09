"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { SESSION_MOOD_OPTIONS } from "@/lib/coach/session-mood-check-in"

type CompanionMoodCheckInProps = {
  onSubmit: (mood: string) => Promise<void> | void
  compact?: boolean
}

export function CompanionMoodCheckIn({ onSubmit, compact = false }: CompanionMoodCheckInProps) {
  const [draft, setDraft] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit() {
    if (!draft || isSaving) return
    setIsSaving(true)
    try {
      await onSubmit(draft)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <DashboardInsetPanel
      className={
        compact
          ? "border-cyan-glow/25 bg-cyan-glow/[0.06] px-3 py-2.5"
          : "border-cyan-glow/30 bg-cyan-glow/[0.08] px-3 py-3"
      }
    >
      <p className="text-[12px] font-medium text-foreground/92">
        How are you feeling right now?
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/75">
        Coach scores your trader state from today&apos;s mood — not old journal entries alone.
      </p>
      <div className="mt-2.5 space-y-2">
        <Select
          value={draft || undefined}
          onValueChange={(value) => setDraft(value)}
        >
          <SelectTrigger className="add-trade-input h-10 w-full">
            <SelectValue placeholder="Select your emotional state" />
          </SelectTrigger>
          <SelectContent className="z-[70] glass-card border-white/[0.08]">
            {SESSION_MOOD_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          disabled={!draft || isSaving}
          onClick={() => void handleSubmit()}
          className="h-10 w-full btn-primary"
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : "Save mood check-in"}
        </Button>
      </div>
    </DashboardInsetPanel>
  )
}
