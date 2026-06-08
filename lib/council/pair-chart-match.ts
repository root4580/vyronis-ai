import type { CouncilAgentId, CouncilChartSnapshot, CouncilVisualContext } from "@/lib/council/types"

const CHART_AGENTS = new Set<CouncilAgentId>(["luna", "cipher", "zara", "jarvis"])

const PAIR_PATTERN =
  /\b([A-Z]{3})[\s/.-]?([A-Z]{3})\b|\b([A-Z]{6})\b/gi

function normalizePairToken(raw: string): string {
  return raw.replace(/[\s/.-]/g, "").toUpperCase()
}

export function extractPairsFromText(content: string): string[] {
  const found = new Set<string>()
  for (const match of content.matchAll(PAIR_PATTERN)) {
    if (match[1] && match[2]) {
      found.add(normalizePairToken(`${match[1]}${match[2]}`))
    } else if (match[3]) {
      found.add(normalizePairToken(match[3]))
    }
  }
  return [...found]
}

function chartPairKey(chart: CouncilChartSnapshot): string {
  return normalizePairToken(chart.pair)
}

export function listCouncilCharts(visual: CouncilVisualContext | null): CouncilChartSnapshot[] {
  if (!visual) return []
  const seen = new Set<string>()
  const charts: CouncilChartSnapshot[] = []
  for (const chart of [
    ...visual.watchlistCharts,
    ...visual.recentTradeCharts,
    visual.lastTradeChart,
  ].filter(Boolean)) {
    if (!chart || seen.has(chart.url)) continue
    seen.add(chart.url)
    charts.push(chart)
  }
  return charts
}

export function findChartForMessage(
  agent: CouncilAgentId | "user" | "system",
  content: string,
  visual: CouncilVisualContext | null,
): CouncilChartSnapshot | null {
  if (agent === "user" || agent === "system" || !CHART_AGENTS.has(agent) || !visual) {
    return null
  }

  const charts = listCouncilCharts(visual)
  if (charts.length === 0) return null

  const pairs = extractPairsFromText(content)
  for (const pair of pairs) {
    const match = charts.find((chart) => chartPairKey(chart) === pair)
    if (match) return match
  }

  return null
}
