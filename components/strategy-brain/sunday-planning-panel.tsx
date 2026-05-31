"use client"

import { useCallback, useState } from "react"
import { CalendarDays, Plus, Trash2 } from "lucide-react"
import { saveWeeklyPlan } from "@/lib/strategy-brain/api-client"
import { FOREX_PAIRS, formatWeekLabel } from "@/lib/strategy-brain/week-utils"
import {
  WEEKLY_WATCHLIST_MAX,
  WEEKLY_WATCHLIST_MIN,
  WEEKLY_WATCHLIST_RECOMMENDED,
} from "@/lib/strategy-brain/weekly-watchlist"
import type { BiasDirection, MarketBiasInput, PairPlanInput, WeeklyPlanWithPairs } from "@/lib/strategy-brain/types"
import type { WarRoomVisionAutofill } from "@/lib/strategy-brain/war-room-vision-types"
import { WarRoomSurfaceCard } from "@/components/strategy-brain/strategy-brain-primitives"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { WarRoomHtfUpload } from "@/components/strategy-brain/war-room-htf-upload"
import { cn } from "@/lib/utils"

type DraftPair = PairPlanInput & { _key: string }

function emptyPair(): DraftPair {
  return {
    _key: crypto.randomUUID(),
    pair: "EURUSD",
    directional_bias: "Neutral",
    aoi_high: null,
    aoi_low: null,
    invalidation: null,
    weekly_thesis: "",
    notes: "",
  }
}

type Props = {
  initial: WeeklyPlanWithPairs | null
  weekStart: string
  onSaved?: (plan: WeeklyPlanWithPairs) => void
  onBiasSuggest?: (bias: MarketBiasInput) => void
}

function applyAutofillToPair(pair: DraftPair, autofill: WarRoomVisionAutofill): DraftPair {
  return {
    ...pair,
    pair: autofill.pair || pair.pair,
    directional_bias: autofill.directional_bias,
    aoi_low: autofill.aoi_low,
    aoi_high: autofill.aoi_high,
    invalidation: autofill.invalidation,
    weekly_thesis: autofill.weekly_thesis || pair.weekly_thesis,
    notes: autofill.notes || pair.notes,
  }
}

function PairBiasButtons({
  value,
  onChange,
}: {
  value: BiasDirection
  onChange: (value: BiasDirection) => void
}) {
  const options: BiasDirection[] = ["Bullish", "Bearish", "Neutral"]
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-[var(--radius-sm)] border px-2 py-1 text-[11px] font-medium transition-colors",
            value === opt
              ? opt === "Bullish"
                ? "border-profit/30 bg-profit/[0.12] text-profit"
                : opt === "Bearish"
                  ? "border-loss/25 bg-loss/10 text-loss"
                  : "border-[var(--border-default)] bg-white/[0.06] text-text-secondary"
              : "border-white/[0.08] bg-transparent text-text-muted",
          )}
        >
          {opt === "Bullish" ? "Bull" : opt === "Bearish" ? "Bear" : "Neutral"}
        </button>
      ))}
    </div>
  )
}

export function SundayPlanningPanel({ initial, weekStart, onSaved, onBiasSuggest }: Props) {
  const { toast } = useToast()
  const [notes, setNotes] = useState(initial?.session_notes ?? "")
  const [pairs, setPairs] = useState<DraftPair[]>(() => {
    if (initial?.pairs?.length) {
      return initial.pairs.map((p) => ({
        _key: p.id,
        pair: p.pair,
        directional_bias: p.directional_bias,
        aoi_high: p.aoi_high,
        aoi_low: p.aoi_low,
        invalidation: p.invalidation,
        weekly_thesis: p.weekly_thesis,
        notes: p.notes,
        screenshot_urls: p.screenshot_urls ?? [],
      }))
    }
    return [emptyPair(), emptyPair(), emptyPair()]
  })
  const [saving, setSaving] = useState(false)

  const updatePair = useCallback((key: string, patch: Partial<DraftPair>) => {
    setPairs((prev) => prev.map((p) => (p._key === key ? { ...p, ...patch } : p)))
  }, [])

  function addPair() {
    if (pairs.length >= 5) {
      toast({ title: "Maximum 5 pairs per week", variant: "destructive" })
      return
    }
    setPairs((p) => [...p, emptyPair()])
  }

  function removePair(key: string) {
    setPairs((p) => (p.length <= 1 ? p : p.filter((x) => x._key !== key)))
  }

  async function handleSave() {
    const filled = pairs.filter((p) => p.pair?.trim())
    if (filled.length < WEEKLY_WATCHLIST_MIN) {
      toast({
        title: "Add at least one pair",
        description: `Pick the pair you are trading this week (up to ${WEEKLY_WATCHLIST_MAX}).`,
        variant: "destructive",
      })
      return
    }
    setSaving(true)
    try {
      const payload: PairPlanInput[] = filled.map((p, i) => ({
        pair: p.pair,
        directional_bias: p.directional_bias as BiasDirection,
        aoi_high: p.aoi_high,
        aoi_low: p.aoi_low,
        invalidation: p.invalidation,
        weekly_thesis: p.weekly_thesis,
        notes: p.notes,
        screenshot_urls: p.screenshot_urls ?? [],
        sort_order: i,
      }))
      const plan = await saveWeeklyPlan({
        week_start: weekStart,
        session_notes: notes,
        pairs: payload,
      })
      onSaved?.(plan)
      if (filled.length < WEEKLY_WATCHLIST_RECOMMENDED) {
        toast({
          title: "Sunday plan saved",
          description: `Single-pair week (${filled[0]?.pair}). Add more pairs anytime if you expand focus.`,
        })
      } else {
        toast({ title: "Sunday plan saved" })
      }
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <WarRoomSurfaceCard>
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3.5">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-3.5 text-text-accent" />
          <div>
            <p className="text-[11px] font-medium text-text-accent">Sunday planning</p>
            <p className="text-[11px] text-text-muted">{formatWeekLabel(weekStart)}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPair}
          disabled={pairs.length >= 5}
          className="h-8 border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] text-[11px] text-text-accent hover:bg-[var(--color-accent-bg)] disabled:opacity-40"
        >
          <Plus className="mr-1 size-3.5" />
          Pair
        </Button>
      </div>

      <div className="border-b border-[var(--border-subtle)] px-4 py-3">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Weekly session notes — macro context, events, focus pairs…"
          className="war-room-textarea min-h-[72px] resize-none placeholder:text-text-muted"
        />
      </div>

      <div className="divide-y divide-[var(--border-subtle)]">
        {pairs.map((p) => (
          <div key={p._key} className="px-4 py-3.5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Select value={p.pair} onValueChange={(v) => updatePair(p._key, { pair: v })}>
                <SelectTrigger className="h-9 w-[128px] rounded-[var(--radius-sm)] border-[var(--border-default)] bg-white/[0.04] text-[13px] font-medium text-text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[min(280px,50vh)]">
                  {FOREX_PAIRS.map((sym) => (
                    <SelectItem key={sym} value={sym}>
                      {sym}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <PairBiasButtons
                value={(p.directional_bias ?? "Neutral") as BiasDirection}
                onChange={(directional_bias) => updatePair(p._key, { directional_bias })}
              />
              <button
                type="button"
                onClick={() => removePair(p._key)}
                className="ml-auto flex size-[26px] items-center justify-center rounded-[var(--radius-sm)] text-text-muted hover:bg-loss/10 hover:text-loss"
                aria-label="Remove pair"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="mb-1 text-[10px] text-text-muted">AOI low</p>
                <Input
                  placeholder="154.20"
                  type="number"
                  step="any"
                  className="war-room-input h-9"
                  value={p.aoi_low ?? ""}
                  onChange={(e) =>
                    updatePair(p._key, {
                      aoi_low: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div>
                <p className="mb-1 text-[10px] text-text-muted">AOI high</p>
                <Input
                  placeholder="156.80"
                  type="number"
                  step="any"
                  className="war-room-input h-9"
                  value={p.aoi_high ?? ""}
                  onChange={(e) =>
                    updatePair(p._key, {
                      aoi_high: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div>
                <p className="mb-1 text-[10px] text-text-muted">Invalidation</p>
                <Input
                  placeholder="153.90"
                  type="number"
                  step="any"
                  className="war-room-input h-9"
                  value={p.invalidation ?? ""}
                  onChange={(e) =>
                    updatePair(p._key, {
                      invalidation: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>

            <Textarea
              className="war-room-textarea mt-2 min-h-[56px] resize-none placeholder:text-text-muted"
              placeholder="Weekly thesis"
              value={p.weekly_thesis ?? ""}
              onChange={(e) => updatePair(p._key, { weekly_thesis: e.target.value })}
            />
            <Textarea
              className="war-room-textarea mt-2 min-h-[48px] resize-none placeholder:text-text-muted"
              placeholder="Notes"
              value={p.notes ?? ""}
              onChange={(e) => updatePair(p._key, { notes: e.target.value })}
            />

            <WarRoomHtfUpload
              className="mt-3"
              pairHint={p.pair}
              pairLabel={p.pair}
              urls={p.screenshot_urls ?? []}
              disabled={saving}
              onUrlsChange={(screenshot_urls) => updatePair(p._key, { screenshot_urls })}
              onBiasSuggest={onBiasSuggest}
              onAutofill={(autofill) => updatePair(p._key, applyAutofillToPair(p, autofill))}
            />
          </div>
        ))}
      </div>

      <div className="p-4">
        <Button
          className="btn-primary h-11 w-full rounded-[var(--radius-md)]"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save weekly plan"}
        </Button>
      </div>
    </WarRoomSurfaceCard>
  )
}
