"use client"

import { useState } from "react"
import { Compass } from "lucide-react"
import { saveMarketBias } from "@/lib/strategy-brain/api-client"
import type { BiasDirection, MarketBiasRecord } from "@/lib/strategy-brain/types"
import { evaluateMarketBias } from "@/lib/strategy-brain/market-bias-engine"
import { BiasToggle, WarRoomSurfaceCard } from "@/components/strategy-brain/strategy-brain-primitives"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type Props = {
  initial: MarketBiasRecord | null
  onSaved?: (bias: MarketBiasRecord) => void
}

export function MarketBiasPanel({ initial, onSaved }: Props) {
  const { toast } = useToast()
  const [weekly, setWeekly] = useState<BiasDirection>(initial?.weekly_bias ?? "Neutral")
  const [daily, setDaily] = useState<BiasDirection>(initial?.daily_bias ?? "Neutral")
  const [h4, setH4] = useState<BiasDirection>(initial?.h4_bias ?? "Neutral")
  const [saving, setSaving] = useState(false)

  const preview = evaluateMarketBias({
    weekly_bias: weekly,
    daily_bias: daily,
    h4_bias: h4,
  })

  const signalTone =
    preview.directional_permission && preview.setup_valid
      ? "border-l-[var(--color-profit)] text-profit"
      : !preview.setup_valid
        ? "border-l-[var(--color-loss)] text-loss"
        : "border-l-[var(--border-default)] text-text-secondary"

  async function handleSave() {
    setSaving(true)
    try {
      const bias = await saveMarketBias({
        weekly_bias: weekly,
        daily_bias: daily,
        h4_bias: h4,
      })
      onSaved?.(bias)
      toast({ title: "Market bias saved" })
    } catch (e) {
      toast({
        title: "Could not save bias",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <WarRoomSurfaceCard className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Compass className="size-4 text-text-accent" />
        <p className="text-[11px] font-medium text-text-muted">Market bias engine</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <BiasToggle label="Weekly" value={weekly} onChange={setWeekly} />
        <BiasToggle label="Daily" value={daily} onChange={setDaily} />
        <BiasToggle label="H4" value={h4} onChange={setH4} />
      </div>

      <div
        className={cn(
          "mt-3 rounded-r-[var(--radius-sm)] border border-[var(--border-subtle)] border-l-2 bg-white/[0.03] px-3 py-2.5 text-[11.5px] leading-relaxed",
          signalTone,
        )}
      >
        {preview.alignment_summary}
      </div>

      <Button
        className="btn-primary mt-4 h-11 w-full rounded-[var(--radius-md)]"
        onClick={() => void handleSave()}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save HTF bias"}
      </Button>
    </WarRoomSurfaceCard>
  )
}
