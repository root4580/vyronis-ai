import { getSignedPnL } from "@/lib/trade-utils"
import { getTradeTimestamp } from "@/lib/user-settings"

export type EquityCurvePoint = {
  date: string
  equity: number
  pnl: number
}

type EquityTradeRow = {
  trade_date: string | null
  created_at: string
  pnl: number
  result: string
}

/** Build cumulative equity series from journal trades (oldest → newest). */
export function buildEquityCurvePoints(
  trades: EquityTradeRow[],
  startingBalance: number,
): EquityCurvePoint[] {
  const base = Number(startingBalance) || 10000
  const sorted = [...trades].sort((a, b) => getTradeTimestamp(a) - getTradeTimestamp(b))
  const points: EquityCurvePoint[] = [{ date: "Start", equity: base, pnl: 0 }]

  let cumulative = 0
  for (const trade of sorted) {
    const pnl = getSignedPnL(Number(trade.pnl), trade.result)
    cumulative += pnl
    const date = new Date(trade.trade_date || trade.created_at)
    points.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      equity: base + cumulative,
      pnl,
    })
  }

  return points
}

/** Tight Y domain so drawdowns are visible (avoid anchoring at $0 on funded accounts). */
export function computeEquityChartDomain(points: EquityCurvePoint[]): [number, number] {
  if (points.length === 0) return [0, 10000]

  const values = points.map((p) => Number(p.equity)).filter(Number.isFinite)
  if (values.length === 0) return [0, 10000]

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const padding = span > 0 ? Math.max(span * 0.1, 25) : Math.max(max * 0.02, 100)

  return [min - padding, max + padding]
}
