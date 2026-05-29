"use client"

import { AlertTriangle, Brain, Check, Lightbulb, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TradingViewMemoryMatchKind, TradingViewWhyEngine } from "@/lib/tradingview/types"

type TradingViewWhyPanelProps = {
  why: TradingViewWhyEngine
  compact?: boolean
  className?: string
}

function ReasonList({
  items,
  icon: Icon,
  iconClass,
  label,
}: {
  items: string[]
  icon: typeof Check
  iconClass: string
  label: string
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/65">
        {label}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((line) => (
          <li key={line} className="flex gap-2 text-[11px] leading-relaxed text-foreground/85">
            <Icon className={cn("mt-0.5 size-3 shrink-0", iconClass)} />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function matchKindLabel(kind: TradingViewMemoryMatchKind): string {
  switch (kind) {
    case "winner":
      return "Winner"
    case "loser":
      return "Loss"
    case "impulsive":
      return "Impulsive"
    case "high_confidence":
      return "High confidence"
    default:
      return "Match"
  }
}

export function TradingViewWhyPanel({ why, compact = false, className }: TradingViewWhyPanelProps) {
  const { memory_similarity: memory } = why

  return (
    <div
      className={cn(
        "rounded-lg border border-white/[0.08] bg-white/[0.02]",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan-glow/85">
        <Brain className="size-3.5" />
        Vyronis reasoning
      </p>
      <p className="mt-1 text-[11px] font-medium text-foreground/90">{why.headline}</p>
      {why.ai_router && !why.ai_router.is_mock ? (
        <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground/75">
          <span className="font-medium text-cyan-glow/80">AI router ({why.ai_router.provider})</span>
          {" · "}
          Grade {why.ai_router.grade} · {why.ai_router.summary}
        </p>
      ) : null}
      <p className="mt-1 text-[10px] text-muted-foreground/65">
        Historical confidence {why.historical_confidence}%
        {memory.overall_similarity > 0 ? ` · ${memory.overall_similarity}% profile match` : ""}
      </p>

      <div className={cn("mt-2 grid gap-1.5", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        {why.confidence_categories.map((cat) => (
          <div
            key={cat.id}
            className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5"
          >
            <p className="text-[9px] text-muted-foreground/65">{cat.label}</p>
            <p className="text-[11px] font-semibold tabular-nums text-foreground/90">
              {cat.score}%
            </p>
          </div>
        ))}
      </div>

      {memory.matches.length > 0 ? (
        <div className="mt-2 space-y-1">
          {memory.matches.slice(0, compact ? 2 : 4).map((match) => (
            <p
              key={`${match.kind}-${match.trade_id}`}
              className="text-[10px] leading-relaxed text-muted-foreground/75"
            >
              <span className="font-medium text-foreground/85">
                {matchKindLabel(match.kind)}:
              </span>{" "}
              {match.pair} {match.result} · {match.similarity_score}% similar
            </p>
          ))}
        </div>
      ) : null}

      <div className={cn("space-y-2.5", compact ? "mt-2" : "mt-3")}>
        <ReasonList
          items={why.pass_reasons}
          icon={Check}
          iconClass="text-profit"
          label="Why it passed"
        />
        <ReasonList
          items={why.fail_reasons}
          icon={X}
          iconClass="text-loss/90"
          label="Why it failed or is weak"
        />
        {why.improvements.length > 0 ? (
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/65">
              <Lightbulb className="size-3" />
              What could improve
            </p>
            <ul className="mt-1.5 space-y-1">
              {why.improvements.slice(0, compact ? 2 : 4).map((line) => (
                <li key={line} className="text-[11px] leading-relaxed text-foreground/80">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {why.memory_insights.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/65">
              Memory
            </p>
            <ul className="mt-1.5 space-y-1">
              {why.memory_insights.slice(0, compact ? 2 : 4).map((line) => (
                <li
                  key={line}
                  className="text-[11px] leading-relaxed text-muted-foreground/80"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {why.warnings.length > 0 ? (
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-300/80">
              <AlertTriangle className="size-3" />
              Warnings
            </p>
            <ul className="mt-1.5 space-y-1">
              {why.warnings.slice(0, compact ? 2 : 3).map((line) => (
                <li key={line} className="text-[11px] leading-relaxed text-amber-200/75">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <p className="mt-2.5 rounded-md border border-cyan-glow/15 bg-cyan-glow/[0.05] px-2.5 py-2 text-[11px] leading-relaxed text-cyan-glow/95">
        <span className="font-semibold">Recommendation: </span>
        {why.recommendation}
      </p>
    </div>
  )
}
