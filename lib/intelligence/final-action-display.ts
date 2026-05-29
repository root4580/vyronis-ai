import type { VerdictReasoning } from "@/lib/intelligence/verdict-reasoning-engine"

/** Trader-facing final action — scannable in under 2 seconds. */
export type TraderFinalAction = "SKIP" | "WAIT" | "A+" | "EXECUTE"

export type TraderFinalActionDisplay = {
  action: TraderFinalAction
  subline: string
  tone: "skip" | "wait" | "execute" | "aplus"
}

export function deriveTraderFinalAction(reasoning: VerdictReasoning): TraderFinalActionDisplay {
  if (reasoning.verdict === "SKIP" || reasoning.finalActionLabel === "SKIP") {
    return {
      action: "SKIP",
      subline: "Stand down — protect capital and process.",
      tone: "skip",
    }
  }

  if (reasoning.verdict === "CAUTION" || reasoning.finalActionLabel === "REDUCE") {
    return {
      action: "WAIT",
      subline: "Pause entry until confirmation or psychology clears.",
      tone: "wait",
    }
  }

  if (reasoning.technicalSetupScore >= 72 && reasoning.traderStateScore >= 58) {
    return {
      action: "A+",
      subline: "Process-aligned — execute only with your defined risk.",
      tone: "aplus",
    }
  }

  return {
    action: "EXECUTE",
    subline: "Proceed with plan, size, and invalidation locked.",
    tone: "execute",
  }
}

export const TRADER_FINAL_ACTION_STYLES: Record<
  TraderFinalActionDisplay["tone"],
  string
> = {
  skip: "border-loss/40 bg-loss/[0.12] text-loss shadow-[0_0_32px_rgba(239,68,68,0.12)]",
  wait: "border-amber-500/35 bg-amber-500/[0.1] text-amber-100 shadow-[0_0_28px_rgba(245,158,11,0.1)]",
  execute: "border-cyan-glow/35 bg-cyan-glow/[0.1] text-cyan-glow shadow-[0_0_28px_rgba(34,211,238,0.12)]",
  aplus:
    "border-profit/40 bg-profit/[0.12] text-profit shadow-[0_0_32px_rgba(34,197,94,0.14)]",
}
