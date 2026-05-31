"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { evaluateStrategySetup } from "@/lib/strategy-brain/api-client"
import { defaultConfirmationChecklist } from "@/lib/strategy-brain/confirmation-engine"
import { defaultEmotionAnswers, EMOTION_CHECK_QUESTIONS } from "@/lib/strategy-brain/emotion-engine"
import { SCORING_RULE_POINTS } from "@/lib/strategy-brain/aplus-scoring-engine"
import type {
  BiasDirection,
  ConfirmationChecklist,
  EmotionCheckAnswers,
  PairPlanRecord,
  StrategySetupEvaluationResult,
} from "@/lib/strategy-brain/types"
import {
  GradeBadge,
  RecommendationBadge,
  SectionLabel,
  StrategyBrainGlass,
} from "@/components/strategy-brain/strategy-brain-primitives"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type CheckKey = keyof ConfirmationChecklist

const CHECK_ITEMS: { key: CheckKey; label: string }[] = [
  { key: "break_and_retest", label: "Break & retest" },
  { key: "ltf_structure_shift", label: "LTF structure shift" },
  { key: "momentum_confirmation", label: "Momentum" },
  { key: "ema_confirmation", label: "EMA" },
  { key: "clear_invalidation", label: "Clear invalidation" },
  { key: "acceptable_rr", label: "Acceptable RR" },
]

function cycleCheck(v: boolean | "borderline"): boolean | "borderline" {
  if (v === false) return true
  if (v === true) return "borderline"
  return false
}

type Props = {
  pairPlans: PairPlanRecord[]
}

export function SetupEvaluatorPanel({ pairPlans }: Props) {
  const [pair, setPair] = useState(pairPlans[0]?.pair ?? "EURUSD")
  const [pairBias, setPairBias] = useState<BiasDirection>(
    pairPlans[0]?.directional_bias ?? "Neutral",
  )
  const [confirmation, setConfirmation] = useState<ConfirmationChecklist>(
    defaultConfirmationChecklist(),
  )
  const [emotion, setEmotion] = useState<EmotionCheckAnswers>(defaultEmotionAnswers())
  const [aoiReached, setAoiReached] = useState(false)
  const [rr, setRr] = useState("2")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<StrategySetupEvaluationResult | null>(null)

  const selectedPlan = pairPlans.find((p) => p.pair === pair)

  async function runEvaluate() {
    setLoading(true)
    try {
      const res = await evaluateStrategySetup({
        pair,
        pair_plan_id: selectedPlan?.id,
        pair_bias: pairBias,
        confirmation,
        aoi_reached: aoiReached,
        risk_reward: rr ? Number(rr) : null,
        emotion_answers: emotion,
        save_snapshot: true,
      })
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  return (
    <StrategyBrainGlass>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-cyan-glow" />
        <SectionLabel>Confirmation & A+ scoring</SectionLabel>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {pairPlans.length > 0 ? (
          pairPlans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPair(p.pair)
                setPairBias(p.directional_bias)
              }}
              className={cn(
                "rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors",
                pair === p.pair
                  ? "border-cyan-glow/40 bg-cyan-glow/10 text-cyan-glow"
                  : "border-white/[0.06] text-muted-foreground",
              )}
            >
              {p.pair}
            </button>
          ))
        ) : (
          <Input
            value={pair}
            onChange={(e) => setPair(e.target.value.toUpperCase())}
            className="h-8 w-28 text-xs"
          />
        )}
        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <input
            type="checkbox"
            checked={aoiReached}
            onChange={(e) => setAoiReached(e.target.checked)}
          />
          AOI reached (+{SCORING_RULE_POINTS.aoi_reached} pts)
        </label>
        <Input
          placeholder="RR"
          value={rr}
          onChange={(e) => setRr(e.target.value)}
          className="h-8 w-16 text-xs"
        />
      </div>

      <p className="mb-2 text-[10px] text-muted-foreground/65">
        Tap each item: off → yes → borderline. Missing items weaken the setup.
      </p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {CHECK_ITEMS.map(({ key, label }) => {
          const v = confirmation[key]
          return (
            <button
              key={key}
              type="button"
              onClick={() =>
                setConfirmation((c) => ({ ...c, [key]: cycleCheck(c[key]) }))
              }
              className={cn(
                "rounded-lg border px-2 py-2 text-left text-[10px] transition-colors",
                v === true && "border-profit/30 bg-profit/10 text-profit",
                v === "borderline" && "border-warning/30 bg-warning/10 text-warning-muted",
                v === false && "border-white/[0.06] bg-black/20 text-muted-foreground",
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
        <p className="text-[10px] font-medium text-muted-foreground/70">Pre-trade emotion gate</p>
        {EMOTION_CHECK_QUESTIONS.map((q) => (
          <label
            key={q.key}
            className="flex items-center justify-between gap-2 text-[11px] text-foreground/85"
          >
            <span>{q.label}</span>
            <input
              type="checkbox"
              checked={
                q.positiveWhen ? emotion[q.key] : !emotion[q.key]
              }
              onChange={(e) => {
                const checked = e.target.checked
                setEmotion((prev) => ({
                  ...prev,
                  [q.key]: q.positiveWhen ? checked : !checked,
                }))
              }}
            />
          </label>
        ))}
      </div>

      <Button className="mt-3 w-full" onClick={() => void runEvaluate()} disabled={loading}>
        {loading ? "Evaluating…" : "Run strategy evaluation"}
      </Button>

      {result ? (
        <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <GradeBadge grade={result.scoring.grade} />
            <span className="text-lg font-bold tabular-nums text-foreground">
              {result.scoring.totalScore}
              <span className="text-sm font-normal text-muted-foreground">
                /{result.scoring.maxScore}
              </span>
            </span>
            <RecommendationBadge rec={result.scoring.recommendation} />
          </div>
          <p className="text-[11px] leading-relaxed text-foreground/82">
            {result.scoring.recommendationReason}
          </p>
          {result.memoryInsight ? (
            <p className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-2.5 py-2 text-[11px] text-violet-100/90">
              {result.memoryInsight}
            </p>
          ) : null}
          <p className="text-[10px] text-muted-foreground/65">{result.confirmation.summary}</p>
        </div>
      ) : null}
    </StrategyBrainGlass>
  )
}
