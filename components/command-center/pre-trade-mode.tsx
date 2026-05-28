"use client"

import { CognitiveSurface } from "@/components/command-center/cognitive-surface"
import { TradingOsAlertStrip } from "@/components/trading-os/trading-os-alert-strip"
import { TradeCoachPanel } from "@/components/dashboard/trade-coach-modal"
import { CommandCenterInput } from "@/components/command-center/command-center-input"
import { useAIContext } from "@/providers/ai-context-provider"

export function PreTradeMode() {
  const {
    context,
    mode,
    coachSessionId,
    coachPlannedContext,
    maxRiskPerTrade,
    handleCoachSessionChange,
    handleCoachCompleted,
    returnToCompanion,
    sendMessage,
    isLoading,
    isThinking,
    streamingMessage,
  } = useAIContext()

  const active = mode === "pre_trade"

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <TradingOsAlertStrip tradingOs={context?.tradingOs} />
      <CognitiveSurface cognitive={context?.cognitive} />
      <div className="min-h-0 flex-1 overflow-hidden">
        <TradeCoachPanel
          active={active}
          embedded
          showHeader={false}
          plannedContext={coachPlannedContext}
          maxRiskPerTrade={maxRiskPerTrade}
          sessionId={coachSessionId}
          onSessionChange={handleCoachSessionChange}
          onCompleted={handleCoachCompleted}
          onClose={() => void returnToCompanion()}
        />
      </div>
      <div className="shrink-0 border-t border-white/[0.06] pt-2">
        <p className="mb-1.5 px-1 text-[10px] text-muted-foreground/65">
          Upload one or more charts — AI infers timeframes and links analysis to this pre-trade session.
        </p>
        <CommandCenterInput
          onSend={sendMessage}
          disabled={isLoading || isThinking || Boolean(streamingMessage)}
          placeholder="Ask about this setup or upload a chart…"
        />
      </div>
    </div>
  )
}
