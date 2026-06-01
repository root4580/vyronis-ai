"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { updateCouncilSettings } from "@/lib/council/api-client"
import { readFreshChatOnOpen, writeFreshChatOnOpen } from "@/lib/council/fresh-chat-preference"
import {
  readFullCouncilParticipation,
  writeFullCouncilParticipation,
} from "@/lib/council/full-council-preference"
import type { CouncilSettingsRecord } from "@/lib/council/types"
import { cn } from "@/lib/utils"

type CouncilSettingsPanelProps = {
  settings: CouncilSettingsRecord | null
  onSettingsChange: (settings: CouncilSettingsRecord) => void
  onFreshChatChange?: (enabled: boolean) => void
  onFullCouncilChange?: (enabled: boolean) => void
  className?: string
}

export function CouncilSettingsPanel({
  settings,
  onSettingsChange,
  onFreshChatChange,
  onFullCouncilChange,
  className,
}: CouncilSettingsPanelProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [freshChatOnOpen, setFreshChatOnOpen] = useState(true)
  const [fullCouncilParticipation, setFullCouncilParticipation] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const enabled = readFreshChatOnOpen()
    setFreshChatOnOpen(enabled)
    onFreshChatChange?.(enabled)
    const fullCouncil = readFullCouncilParticipation()
    setFullCouncilParticipation(fullCouncil)
    onFullCouncilChange?.(fullCouncil)
  }, [settings?.id])

  if (!settings) return null

  async function savePatch(patch: { auto_briefing_enabled?: boolean; briefing_time?: string }) {
    setSaving(true)
    setError(null)
    try {
      const result = await updateCouncilSettings(patch)
      onSettingsChange(result.settings)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings")
    } finally {
      setSaving(false)
    }
  }

  function toggleFreshChat() {
    const next = !freshChatOnOpen
    writeFreshChatOnOpen(next)
    setFreshChatOnOpen(next)
    onFreshChatChange?.(next)
  }

  function toggleFullCouncil() {
    const next = !fullCouncilParticipation
    writeFullCouncilParticipation(next)
    setFullCouncilParticipation(next)
    onFullCouncilChange?.(next)
  }

  return (
    <section className={cn("rounded-[var(--radius-md)] border border-white/[0.06] bg-white/[0.02]", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-[11px] font-medium text-text-secondary">
          <Settings2 className="size-3.5 text-text-muted" />
          Council settings
        </span>
        {open ? <ChevronUp className="size-3.5 text-text-muted" /> : <ChevronDown className="size-3.5 text-text-muted" />}
      </button>
      {open ? (
        <div className="space-y-3 border-t border-white/[0.06] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-text-primary">Fresh chat on open</p>
              <p className="text-[10px] text-text-muted">
                Start with a clean screen each visit. Agents still remember your trades and past replies.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={freshChatOnOpen ? "default" : "outline"}
              onClick={toggleFreshChat}
            >
              {freshChatOnOpen ? "On" : "Off"}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-text-primary">Full council replies</p>
              <p className="text-[10px] text-text-muted">
                With Auto selected, every specialist responds in turn — then Jarvis summarizes.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={fullCouncilParticipation ? "default" : "outline"}
              onClick={toggleFullCouncil}
            >
              {fullCouncilParticipation ? "On" : "Off"}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-text-primary">Auto morning briefing</p>
              <p className="text-[10px] text-text-muted">Runs once before noon when you open Council.</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={settings.auto_briefing_enabled ? "default" : "outline"}
              disabled={saving}
              onClick={() =>
                void savePatch({ auto_briefing_enabled: !settings.auto_briefing_enabled })
              }
            >
              {settings.auto_briefing_enabled ? "On" : "Off"}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-medium text-text-primary">Briefing trigger</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "on_login", label: "On login" },
                { id: "manual", label: "Manual only" },
              ].map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={settings.briefing_time === option.id ? "default" : "outline"}
                  disabled={saving}
                  onClick={() => void savePatch({ briefing_time: option.id })}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <p className="text-[10px] leading-relaxed text-text-muted">
            Voice IDs are configured via ElevenLabs env vars (`ELEVENLABS_JARVIS_VOICE_ID`, etc.).
          </p>

          {error ? <p className="text-[11px] text-loss">{error}</p> : null}
        </div>
      ) : null}
    </section>
  )
}
