import type { FullTraderContext } from "@/lib/intelligence/intelligence-types"
import type { SessionIntelligence, SessionMarketContext } from "@/lib/autonomous/types"

function utcHour(): number {
  return new Date().getUTCHours()
}

function detectPhase(hour: number): string {
  if (hour >= 7 && hour < 12) return "london"
  if (hour >= 12 && hour < 17) return "ny_overlap"
  if (hour >= 17 && hour < 21) return "ny"
  if (hour >= 0 && hour < 7) return "asia"
  return "off_hours"
}

function resolveMarketContext(
  phase: string,
  context: FullTraderContext,
): SessionMarketContext {
  const perf = context.sessionPerformance
  const london = perf.find((s) => /london/i.test(s.name))
  const ny = perf.find((s) => /ny|new york/i.test(s.name))
  const asia = perf.find((s) => /asia/i.test(s.name))

  if (phase === "off_hours" || (utcHour() >= 21 && utcHour() < 23)) {
    return "low_liquidity"
  }

  if (phase === "london" && london && london.winRate >= 55) {
    return "london_continuation"
  }

  if (phase === "ny" || phase === "ny_overlap") {
    if (ny && ny.winRate < 45 && london && london.winRate >= 50) {
      return "ny_reversal"
    }
    if (ny && ny.winRate >= 55) return "london_continuation"
  }

  if (phase === "asia") {
    return "asia_compression"
  }

  if (context.memory.snapshot.todayTradeCount >= 3 && context.risk.todayLossPercent > 2) {
    return "news_volatility"
  }

  return "neutral"
}

function buildNarrative(
  phase: string,
  marketContext: SessionMarketContext,
  context: FullTraderContext,
): { narrative: string; tradingBias: string; liquidityNote: string; volatilityNote: string } {
  const preferred = context.preferredSession || "your session"

  switch (marketContext) {
    case "london_continuation":
      return {
        narrative: `London window — trend continuation tends to work better for you than fade plays.`,
        tradingBias: "With-trend continuation",
        liquidityNote: "Solid liquidity on majors",
        volatilityNote: "Directional moves more reliable early London",
      }
    case "ny_reversal":
      return {
        narrative: `NY phase — your journal shows more reversal/mean-reversion behavior than London continuation.`,
        tradingBias: "Reversal / fade with confirmation",
        liquidityNote: "High liquidity, watch false breakouts",
        volatilityNote: "Afternoon reversals common after London impulse",
      }
    case "asia_compression":
      return {
        narrative: `Asia session — range compression dominates; breakouts need extra confirmation.`,
        tradingBias: "Range — wait for expansion",
        liquidityNote: "Thinner liquidity on some pairs",
        volatilityNote: "Compressed ranges — avoid chasing micro moves",
      }
    case "news_volatility":
      return {
        narrative: `Elevated volatility today — size down and widen invalidation.`,
        tradingBias: "Defensive — A+ only",
        liquidityNote: "Spreads may widen",
        volatilityNote: "News-driven spikes possible",
      }
    case "low_liquidity":
      return {
        narrative: `Off-hours / low liquidity — avoid new risk unless setup is exceptional.`,
        tradingBias: "Stand aside preferred",
        liquidityNote: "Low liquidity",
        volatilityNote: "Unreliable price action",
      }
    default:
      return {
        narrative: `${preferred} — no strong session bias from your journal; trade your playbook.`,
        tradingBias: "Neutral — playbook-led",
        liquidityNote: "Normal conditions",
        volatilityNote: "Standard volatility",
      }
  }
}

/**
 * Session Intelligence — auto-injected market/session context for every analysis.
 */
export function evaluateSessionIntelligence(
  context: FullTraderContext,
): SessionIntelligence {
  const hour = utcHour()
  const phase = detectPhase(hour)
  const marketContext = resolveMarketContext(phase, context)
  const copy = buildNarrative(phase, marketContext, context)

  return {
    phase,
    marketContext,
    narrative: copy.narrative,
    tradingBias: copy.tradingBias,
    liquidityNote: copy.liquidityNote,
    volatilityNote: copy.volatilityNote,
    confidence: context.sessionPerformance.length >= 2 ? 72 : 48,
  }
}
