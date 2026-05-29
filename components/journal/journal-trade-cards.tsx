"use client"

import { ImageIcon, Pencil, Sparkles, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SetupScoreBadge } from "@/components/dashboard/setup-score-badge"
import type { DashboardTradeRow } from "@/components/dashboard/trading-components"
import { getTradeDisplayMistakeTags } from "@/lib/mistake-tags"
import { MistakeTagList } from "@/components/dashboard/mistake-tag-badge"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import { resolveStoredSetupScore } from "@/lib/trade-coach/setup-score-engine"
import { cn } from "@/lib/utils"

export function JournalTradeCards({
  trades,
  onViewTrade,
  onEdit,
  onDelete,
  onScreenshotClick,
}: {
  trades: DashboardTradeRow[]
  onViewTrade?: (trade: DashboardTradeRow) => void
  onEdit?: (trade: DashboardTradeRow) => void
  onDelete?: (trade: DashboardTradeRow) => void
  onScreenshotClick?: (trade: DashboardTradeRow) => void
}) {
  if (trades.length === 0) return null

  return (
    <div className="space-y-3 md:hidden">
      {trades.map((trade) => {
        const setupScore = resolveStoredSetupScore(trade)
        const mistakes = getTradeDisplayMistakeTags(trade)
        const resultTone =
          trade.result === "WIN"
            ? "border-profit/25 bg-profit/[0.06]"
            : trade.result === "LOSS"
              ? "border-loss/25 bg-loss/[0.06]"
              : "border-white/[0.08] bg-white/[0.02]"

        return (
          <article
            key={trade.id}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-4 transition-all",
              "hover:border-cyan-glow/25 hover:shadow-[0_0_24px_rgba(34,211,238,0.08)]",
              resultTone,
            )}
          >
            <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-cyan-glow/[0.06] blur-2xl" />

            <div className="relative flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => onViewTrade?.(trade)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold tracking-tight">{trade.pair}</h3>
                  <Badge variant="outline" className="h-5 border-white/10 text-[10px]">
                    {trade.direction}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                  {trade.session || "—"} · {trade.strategy_name || "No strategy"}
                </p>
              </button>
              <p className={cn("text-lg font-bold tabular-nums", getPnLTextClass(trade.pnl))}>
                {formatPnL(trade.pnl)}
              </p>
            </div>

            <div className="relative mt-3 flex flex-wrap items-center gap-2">
              <SetupScoreBadge
                classification={setupScore.classification}
                score={setupScore.score}
                showScore
                size="md"
              />
              {trade.result ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 text-[10px]",
                    trade.result === "WIN" && "border-profit/30 text-profit",
                    trade.result === "LOSS" && "border-loss/30 text-loss",
                  )}
                >
                  {trade.result}
                </Badge>
              ) : null}
              {trade.emotion ? (
                <span className="text-[10px] text-muted-foreground/65">{trade.emotion}</span>
              ) : null}
            </div>

            {mistakes.length > 0 ? (
              <div className="relative mt-2">
                <MistakeTagList tags={mistakes} maxVisible={3} />
              </div>
            ) : null}

            {trade.trade_notes ? (
              <p className="relative mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/75">
                {trade.trade_notes}
              </p>
            ) : null}

            {trade.screenshot_url ? (
              <button
                type="button"
                onClick={() => onScreenshotClick?.(trade)}
                className="relative mt-3 flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-black/30"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={trade.screenshot_url}
                  alt=""
                  className="size-full object-cover opacity-90"
                />
              </button>
            ) : null}

            <div className="relative mt-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                className="h-8 flex-1 bg-cyan-glow/90 text-[11px] text-black hover:bg-cyan-glow"
                onClick={() => onViewTrade?.(trade)}
              >
                <Sparkles className="mr-1.5 size-3.5" />
                AI review
              </Button>
              {trade.screenshot_url ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 border-white/[0.08]"
                  onClick={() => onScreenshotClick?.(trade)}
                >
                  <ImageIcon className="size-3.5" />
                </Button>
              ) : null}
              {onEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 border-white/[0.08]"
                  onClick={() => onEdit(trade)}
                >
                  <Pencil className="size-3.5" />
                </Button>
              ) : null}
              {onDelete ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 border-white/[0.08] text-loss/80"
                  onClick={() => onDelete(trade)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
