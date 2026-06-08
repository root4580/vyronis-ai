import { isCouncilLastTradesRequest } from "@/lib/council/data-scope"
import { isCouncilNewsRequest } from "@/lib/council/news-request"
import { findChartForMessage, listCouncilCharts } from "@/lib/council/pair-chart-match"
import type { CouncilAgentId, CouncilChartSnapshot, CouncilVisualContext } from "@/lib/council/types"
import type { TodayCalendarResponse } from "@/lib/economic-calendar/types"
import { formatPairForSpeech } from "@/lib/economic-calendar/pair-impact"

export type CouncilAgentVisualPanel =
  | { kind: "stats-overview"; title: string }
  | { kind: "discipline"; title: string; variant?: "chapter" | "psychology" }
  | { kind: "risk"; title: string }
  | { kind: "trades"; title: string; charts: CouncilChartSnapshot[] }
  | { kind: "watchlist"; title: string; charts: CouncilChartSnapshot[] }
  | { kind: "chart"; title: string; chart: CouncilChartSnapshot }
  | { kind: "news"; title: string; calendar: TodayCalendarResponse | null }

function dedupeCharts(charts: CouncilChartSnapshot[], limit: number): CouncilChartSnapshot[] {
  const seen = new Set<string>()
  const out: CouncilChartSnapshot[] = []
  for (const chart of charts) {
    if (seen.has(chart.url)) continue
    seen.add(chart.url)
    out.push(chart)
    if (out.length >= limit) break
  }
  return out
}

function pickTradeCharts(
  agent: CouncilAgentId,
  content: string,
  visual: CouncilVisualContext,
  pairChart: CouncilChartSnapshot | null,
): CouncilChartSnapshot[] {
  const pool = [
    ...(pairChart ? [pairChart] : []),
    ...visual.recentTradeCharts,
    ...(visual.lastTradeChart ? [visual.lastTradeChart] : []),
  ]
  const charts = dedupeCharts(pool, 2)
  if (charts.length > 0) return charts

  const fallback = findChartForMessage(agent, content, visual)
  return fallback ? [fallback] : []
}

function pickWatchlistCharts(
  agent: CouncilAgentId,
  content: string,
  visual: CouncilVisualContext,
  pairChart: CouncilChartSnapshot | null,
): CouncilChartSnapshot[] {
  if (pairChart) {
    const rest = visual.watchlistCharts.filter((chart) => chart.url !== pairChart.url)
    return dedupeCharts([pairChart, ...rest], 2)
  }
  const fromMessage = findChartForMessage(agent, content, visual)
  if (fromMessage) return dedupeCharts([fromMessage, ...visual.watchlistCharts], 2)
  return dedupeCharts(visual.watchlistCharts, 2)
}

/** Visual panel shown under each council agent message while they explain. */
export function resolveAgentVisualPanel(
  agent: CouncilAgentId | "user" | "system",
  content: string,
  visual: CouncilVisualContext | null,
): CouncilAgentVisualPanel | null {
  if (!visual?.stats || agent === "user" || agent === "system") return null

  const visualWithTrades: CouncilVisualContext = {
    ...visual,
    recentTradeCharts: visual.recentTradeCharts ?? [],
  }

  const pairChart = findChartForMessage(agent, content, visualWithTrades)

  if (isCouncilNewsRequest(content)) {
    return {
      kind: "news",
      title: "Today's high-impact news",
      calendar: visualWithTrades.economicCalendar ?? null,
    }
  }

  switch (agent) {
    case "jarvis":
      return { kind: "stats-overview", title: "HQ · live stats" }
    case "nova":
      return { kind: "discipline", title: "Weekly discipline", variant: "chapter" }
    case "marcus":
      return { kind: "discipline", title: "Mindset & discipline", variant: "psychology" }
    case "rex":
      return { kind: "risk", title: "Risk & account limits" }
    case "zara": {
      const charts = pickTradeCharts(agent, content, visualWithTrades, pairChart)
      const journalTitle = isCouncilLastTradesRequest(content)
        ? "Last trades · Vyronis journal"
        : "Trade journal · charts"
      if (charts.length > 0) {
        return { kind: "trades", title: journalTitle, charts }
      }
      return { kind: "stats-overview", title: "Journal snapshot" }
    }
    case "luna": {
      const charts = pickWatchlistCharts(agent, content, visualWithTrades, pairChart)
      if (charts.length > 0) {
        return { kind: "watchlist", title: "War Room watchlist", charts }
      }
      return { kind: "stats-overview", title: "Account snapshot" }
    }
    case "cipher": {
      const chart =
        pairChart ??
        visualWithTrades.watchlistCharts[0] ??
        visualWithTrades.lastTradeChart ??
        listCouncilCharts(visualWithTrades)[0] ??
        null
      if (chart) {
        return { kind: "chart", title: "Setup · confirmation read", chart }
      }
      const charts = pickWatchlistCharts(agent, content, visualWithTrades, null)
      if (charts.length > 0) {
        return { kind: "watchlist", title: "War Room · setup context", charts }
      }
      return { kind: "stats-overview", title: "Setup snapshot" }
    }
    default:
      return null
  }
}
