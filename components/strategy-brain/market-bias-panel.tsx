"use client"

import { useState } from "react"
import { Compass, CheckCircle2, AlertTriangle } from "lucide-react"
import { saveMarketBias } from "@/lib/strategy-brain/api-client"
import type { BiasDirection, MarketBiasRecord } from "@/lib/strategy-brain/types"
import { evaluateMarketBias } from "@/lib/strategy-brain/market-bias-engine"
import {
  BiasToggle,
  SectionLabel,
  StrategyBrainGlass,
} from "@/components/strategy-brain/strategy-brain-primitives"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

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
    <StrategyBrainGlass>
      <div className="mb-3 flex items-center gap-2">
        <Compass className="size-4 text-cyan-glow" />
        <SectionLabel>Market bias engine</SectionLabel>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <BiasToggle label="Weekly" value={weekly} onChange={setWeekly} />
        <BiasToggle label="Daily" value={daily} onChange={setDaily} />
        <BiasToggle label="H4" value={h4} onChange={setH4} />
      </div>

      <div className="mt-3 space-y-2 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2.5">
        <p className="text-[11px] leading-relaxed text-foreground/85">{preview.alignment_summary}</p>
        <div className="flex flex-wrap gap-2">
          {preview.directional_permission ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-profit">
              <CheckCircle2 className="size-3" />
              Directional permission
            </span>
          ) : null}
          {!preview.setup_valid ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-loss">
              <AlertTriangle className="size-3" />
              Setup invalid — HTF conflict
            </span>
          ) : null}
        </div>
      </div>

      <Button
        size="sm"
        className="mt-3 w-full sm:w-auto"
        onClick={() => void handleSave()}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save HTF bias"}
      </Button>
    </StrategyBrainGlass>
  )
}
