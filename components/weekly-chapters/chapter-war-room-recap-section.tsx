"use client"

import Link from "next/link"
import { Crosshair, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type {
  ChapterWarRoomPairRecap,
  ChapterWarRoomRecap,
} from "@/lib/weekly-chapters/types"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import { cn } from "@/lib/utils"

type ChapterWarRoomRecapSectionProps = {
  recap: ChapterWarRoomRecap
  chapterReviewHref?: string | null
  compact?: boolean
}

const alignmentLabel: Record<ChapterWarRoomPairRecap["alignment"], string> = {
  aligned: "Aligned",
  counter: "Counter bias",
  neutral: "Neutral",
  mixed: "Mixed",
  unplanned: "Off watchlist",
  no_trades: "No trades",
}

const alignmentClass: Record<ChapterWarRoomPairRecap["alignment"], string> = {
  aligned: "border-profit/25 bg-profit/[0.08] text-profit",
  counter: "border-loss/25 bg-loss/[0.08] text-loss",
  neutral: "border-white/[0.08] bg-white/[0.03] text-text-muted",
  mixed: "border-amber-400/25 bg-amber-400/[0.08] text-amber-200",
  unplanned: "border-violet-400/25 bg-violet-500/[0.08] text-violet-200",
  no_trades: "border-white/[0.06] bg-white/[0.02] text-text-muted",
}

export function ChapterWarRoomRecapSection({
  recap,
  chapterReviewHref,
  compact = false,
}: ChapterWarRoomRecapSectionProps) {
  return (
    <section
      id="war-room-recap"
      className={cn(
        "hq-surface-card overflow-hidden",
        compact ? "border border-cyan-glow/15" : undefined,
      )}
    >
      <div className="border-b border-[var(--border-subtle)] bg-cyan-glow/[0.05] px-4 py-3">
        <div className="flex items-start gap-2">
          <Crosshair className="mt-0.5 size-4 shrink-0 text-cyan-glow/90" />
          <div>
            <h2 className="text-[13px] font-medium text-text-primary">War Room vs reality</h2>
            <p className="mt-0.5 text-[11px] text-text-muted">
              Sunday plan compared to live trades this chapter.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {recap.summaryLines.length > 0 ? (
          <ul className="space-y-1.5 text-[12px] leading-relaxed text-text-secondary">
            {recap.summaryLines.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-cyan-glow/80">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {!compact && recap.sessionFocus ? (
          <div className="rounded-[var(--radius-md)] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
              Planned session focus
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
              {recap.sessionFocus}
            </p>
          </div>
        ) : null}

        {!compact && recap.expectedScenarios ? (
          <div className="rounded-[var(--radius-md)] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
              Expected scenarios
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
              {recap.expectedScenarios}
            </p>
          </div>
        ) : null}

        {recap.pairRecaps.length > 0 ? (
          <div className="space-y-2">
            {(compact ? recap.pairRecaps.slice(0, 4) : recap.pairRecaps).map((row) => (
              <PairRecapRow key={`${row.pair}-${row.alignment}`} row={row} compact={compact} />
            ))}
          </div>
        ) : null}

        {compact && chapterReviewHref ? (
          <Button asChild variant="outline" size="sm" className="min-h-10 w-full text-[11px]">
            <Link href={chapterReviewHref}>Full chapter recap →</Link>
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function PairRecapRow({
  row,
  compact,
}: {
  row: ChapterWarRoomPairRecap
  compact?: boolean
}) {
  return (
    <article
      className={cn(
        "rounded-[var(--radius-md)] border px-3 py-2.5",
        alignmentClass[row.alignment],
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-medium text-text-primary">{row.pair}</p>
            {row.plannedBias ? (
              <span className="rounded-[var(--radius-sm)] border border-white/[0.1] bg-black/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]">
                Plan: {row.plannedBias}
              </span>
            ) : null}
            <span className="rounded-[var(--radius-sm)] border border-white/[0.08] bg-black/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase">
              {alignmentLabel[row.alignment]}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed opacity-90">{row.note}</p>
          {!compact && row.plannedThesis ? (
            <p className="mt-1 text-[10px] italic opacity-80">“{row.plannedThesis}”</p>
          ) : null}
        </div>
      </div>

      {row.trades.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {row.trades.map((trade, index) => {
            const isWin = trade.result.toUpperCase() === "WIN" || trade.pnl > 0
            const isLoss = trade.result.toUpperCase() === "LOSS" || trade.pnl < 0
            return (
              <li
                key={`${trade.direction}-${trade.result}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
              >
                <span className="text-text-secondary">
                  {trade.direction} · {trade.result}
                </span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    getPnLTextClass(trade.pnl, isWin ? "WIN" : isLoss ? "LOSS" : "BREAKEVEN"),
                  )}
                >
                  {formatPnL(trade.pnl, isWin ? "WIN" : isLoss ? "LOSS" : "BREAKEVEN")}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </article>
  )
}

export function ChapterWarRoomRecapSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-[120px] items-center justify-center rounded-[var(--radius-md)] border border-white/[0.06] bg-white/[0.02]",
        compact ? "px-3 py-4" : "hq-surface-card px-4 py-8",
      )}
    >
      <Loader2 className="size-5 animate-spin text-cyan-glow/70" />
    </div>
  )
}
