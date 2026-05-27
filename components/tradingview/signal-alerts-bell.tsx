"use client"

import { Bell, Loader2, Radio } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTradingViewSignals } from "@/hooks/use-tradingview-signals"
import type { TradingViewSignalListItem } from "@/lib/tradingview/types"
import { cn } from "@/lib/utils"

type SignalAlertsBellProps = {
  enabled?: boolean
  onSelectSignal: (signal: TradingViewSignalListItem) => void
}

function recommendationClass(rec: string | null | undefined) {
  if (rec === "TAKE") return "border-profit/25 bg-profit/[0.08] text-profit"
  if (rec === "SKIP") return "border-loss/25 bg-loss/[0.08] text-loss"
  return "border-amber-500/25 bg-amber-500/[0.08] text-amber-300"
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString()
}

export function SignalAlertsBell({ enabled = true, onSelectSignal }: SignalAlertsBellProps) {
  const { signals, unreadCount, isLoading, markRead, markAllRead } = useTradingViewSignals(enabled)
  const hasUnread = unreadCount > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative rounded-[10px] border border-transparent p-2 transition-all duration-200 hover:border-white/[0.06] hover:bg-white/[0.04] group",
            hasUnread && "signal-bell-glow border-cyan-glow/25 bg-cyan-glow/[0.06]",
          )}
          title="Setup alerts"
        >
          <Bell
            className={cn(
              "size-4 transition-colors",
              hasUnread ? "text-cyan-glow" : "text-muted-foreground group-hover:text-foreground",
            )}
          />
          {hasUnread ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-cyan-glow px-1 text-[9px] font-semibold text-black shadow-[0_0_12px_rgba(34,211,238,0.55)]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(100vw-2rem,22rem)] border-white/[0.08] bg-[#0a0f14]/98 p-0 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
          <DropdownMenuLabel className="flex items-center gap-2 p-0 text-[12px] font-semibold text-foreground">
            <Radio className="size-3.5 text-cyan-glow" />
            Setup Alerts
          </DropdownMenuLabel>
          {hasUnread ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] text-cyan-glow hover:bg-cyan-glow/10"
              onClick={() => void markAllRead()}
            >
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="max-h-[320px] overflow-y-auto p-1">
          {isLoading && signals.length === 0 ? (
            <div className="flex min-h-[120px] items-center justify-center">
              <Loader2 className="size-4 animate-spin text-cyan-glow" />
            </div>
          ) : signals.length === 0 ? (
            <p className="px-3 py-6 text-center text-[11px] leading-relaxed text-muted-foreground/70">
              No TradingView setup alerts yet. Connect your webhook in Account Settings.
            </p>
          ) : (
            signals.map((signal) => {
              const unread = !signal.read_at
              return (
                <DropdownMenuItem
                  key={signal.id}
                  className={cn(
                    "cursor-pointer flex-col items-start gap-1.5 rounded-lg px-3 py-2.5 focus:bg-cyan-glow/[0.08]",
                    unread && "bg-cyan-glow/[0.04]",
                  )}
                  onClick={() => {
                    if (unread) void markRead(signal.id)
                    onSelectSignal(signal)
                  }}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-foreground">
                        {signal.symbol}{" "}
                        <span className="text-cyan-glow/90">{signal.direction}</span>
                      </p>
                      {signal.strategy_name ? (
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground/75">
                          {signal.strategy_name}
                          {signal.timeframe ? ` · ${signal.timeframe}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
                      {formatRelativeTime(signal.received_at)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {signal.ai_recommendation ? (
                      <Badge
                        variant="outline"
                        className={cn("h-5 text-[9px]", recommendationClass(signal.ai_recommendation))}
                      >
                        {signal.ai_recommendation}
                      </Badge>
                    ) : null}
                    {signal.ai_confidence_score != null ? (
                      <Badge variant="outline" className="h-5 text-[9px]">
                        {Math.round(signal.ai_confidence_score)}/100
                      </Badge>
                    ) : null}
                    {unread ? (
                      <Badge
                        variant="outline"
                        className="h-5 border-cyan-glow/30 bg-cyan-glow/[0.1] text-[9px] text-cyan-glow"
                      >
                        New
                      </Badge>
                    ) : null}
                  </div>
                  {signal.message ? (
                    <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground/70">
                      {signal.message}
                    </p>
                  ) : null}
                </DropdownMenuItem>
              )
            })
          )}
        </div>
        <DropdownMenuSeparator className="bg-white/[0.06]" />
        <div className="px-3 py-2 text-[10px] text-muted-foreground/55">
          Alert-only — Vyronis never places trades from TradingView webhooks.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
