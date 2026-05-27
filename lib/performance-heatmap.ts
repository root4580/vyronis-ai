import { getSignedPnL } from "@/lib/trade-utils"

export type HeatmapTrade = {
  pnl: number
  result: string
  trade_date: string | null
  created_at: string
}

export type HeatmapDay = {
  date: string
  dayNum: number
  pnl: number
  tradeCount: number
  wins: number
  losses: number
  winRate: number
  isToday: boolean
  inMonth: boolean
  isPadding: boolean
}

export type HeatmapMonthStats = {
  monthLabel: string
  year: number
  month: number
  days: HeatmapDay[]
  tradedDays: number
  profitableDays: number
  losingDays: number
  totalPnL: number
  consistencyScore: number
  bestDay: { date: string; pnl: number } | null
  currentStreak: { type: "profit" | "loss" | "none"; count: number }
  longestProfitStreak: number
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseTradeDate(trade: HeatmapTrade): string {
  if (trade.trade_date) return trade.trade_date.split("T")[0]
  return trade.created_at.split("T")[0]
}

function buildDailyMap(trades: HeatmapTrade[]) {
  const map = new Map<
    string,
    { pnl: number; tradeCount: number; wins: number; losses: number }
  >()

  for (const trade of trades) {
    const date = parseTradeDate(trade)
    const current = map.get(date) || { pnl: 0, tradeCount: 0, wins: 0, losses: 0 }
    current.pnl += getSignedPnL(trade.pnl, trade.result)
    current.tradeCount += 1
    if (trade.result === "WIN") current.wins += 1
    if (trade.result === "LOSS") current.losses += 1
    map.set(date, current)
  }

  return map
}

function calculateStreaks(tradedDays: HeatmapDay[]) {
  const sorted = [...tradedDays].sort((a, b) => a.date.localeCompare(b.date))

  let longestProfit = 0
  let runningProfit = 0
  let currentType: "profit" | "loss" | null = null
  let currentCount = 0

  for (const day of sorted) {
    if (day.pnl > 0) {
      runningProfit += 1
      longestProfit = Math.max(longestProfit, runningProfit)
    } else {
      runningProfit = 0
    }
  }

  for (let i = sorted.length - 1; i >= 0; i--) {
    const day = sorted[i]
    if (day.pnl > 0) {
      if (currentType === "profit") currentCount += 1
      else {
        currentType = "profit"
        currentCount = 1
      }
      break
    }
    if (day.pnl < 0) {
      if (currentType === "loss") currentCount += 1
      else {
        currentType = "loss"
        currentCount = 1
      }
      break
    }
  }

  if (currentType === null) {
    return {
      currentStreak: { type: "none" as const, count: 0 },
      longestProfitStreak: longestProfit,
    }
  }

  for (let i = sorted.length - 2; i >= 0; i--) {
    const day = sorted[i]
    if (currentType === "profit" && day.pnl > 0) currentCount += 1
    else if (currentType === "loss" && day.pnl < 0) currentCount += 1
    else break
  }

  return {
    currentStreak: { type: currentType, count: currentCount },
    longestProfitStreak: longestProfit,
  }
}

export function buildPerformanceHeatmap(
  trades: HeatmapTrade[],
  referenceDate = new Date(),
): HeatmapMonthStats {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const todayKey = formatDateKey(referenceDate)
  const monthLabel = referenceDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  const dailyMap = buildDailyMap(trades)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startWeekday = new Date(year, month, 1).getDay()

  const days: HeatmapDay[] = []

  for (let i = 0; i < startWeekday; i++) {
    days.push({
      date: "",
      dayNum: 0,
      pnl: 0,
      tradeCount: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      isToday: false,
      inMonth: false,
      isPadding: true,
    })
  }

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const date = formatDateKey(new Date(year, month, dayNum))
    const stats = dailyMap.get(date)
    const tradeCount = stats?.tradeCount ?? 0
    const wins = stats?.wins ?? 0
    const losses = stats?.losses ?? 0
    const pnl = stats?.pnl ?? 0

    days.push({
      date,
      dayNum,
      pnl,
      tradeCount,
      wins,
      losses,
      winRate: tradeCount > 0 ? Math.round((wins / tradeCount) * 100) : 0,
      isToday: date === todayKey,
      inMonth: true,
      isPadding: false,
    })
  }

  const monthDays = days.filter((day) => day.inMonth)
  const tradedDays = monthDays.filter((day) => day.tradeCount > 0)
  const profitableDays = tradedDays.filter((day) => day.pnl > 0)
  const losingDays = tradedDays.filter((day) => day.pnl < 0)
  const totalPnL = monthDays.reduce((sum, day) => sum + day.pnl, 0)

  const consistencyScore =
    tradedDays.length > 0
      ? Math.round((profitableDays.length / tradedDays.length) * 100)
      : 0

  const bestDay =
    tradedDays.length > 0
      ? tradedDays.reduce(
          (best, day) => (day.pnl > best.pnl ? day : best),
          tradedDays[0],
        )
      : null

  const { currentStreak, longestProfitStreak } = calculateStreaks(tradedDays)

  return {
    monthLabel,
    year,
    month,
    days,
    tradedDays: tradedDays.length,
    profitableDays: profitableDays.length,
    losingDays: losingDays.length,
    totalPnL,
    consistencyScore,
    bestDay: bestDay ? { date: bestDay.date, pnl: bestDay.pnl } : null,
    currentStreak,
    longestProfitStreak,
  }
}

export function getHeatmapIntensityClass(day: HeatmapDay, maxAbsPnl: number): string {
  if (day.isPadding) return "bg-transparent border-transparent"
  if (day.tradeCount === 0) {
    return "bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.05]"
  }

  const ratio = Math.min(Math.abs(day.pnl) / Math.max(maxAbsPnl, 1), 1)

  if (day.pnl > 0) {
    if (ratio >= 0.75) return "bg-profit/85 border-profit/40 shadow-[0_0_14px_rgba(34,197,94,0.22)]"
    if (ratio >= 0.5) return "bg-profit/60 border-profit/30 shadow-[0_0_10px_rgba(34,197,94,0.14)]"
    if (ratio >= 0.25) return "bg-profit/35 border-profit/20"
    return "bg-profit/20 border-profit/15"
  }

  if (ratio >= 0.75) return "bg-loss/85 border-loss/40 shadow-[0_0_14px_rgba(239,68,68,0.22)]"
  if (ratio >= 0.5) return "bg-loss/60 border-loss/30 shadow-[0_0_10px_rgba(239,68,68,0.14)]"
  if (ratio >= 0.25) return "bg-loss/35 border-loss/20"
  return "bg-loss/20 border-loss/15"
}

export function formatHeatmapTooltip(day: HeatmapDay): string {
  if (!day.inMonth || day.isPadding) return ""
  if (day.tradeCount === 0) {
    return `${day.date}\nNo trades`
  }

  const pnlLabel = day.pnl >= 0 ? `+$${day.pnl.toFixed(2)}` : `-$${Math.abs(day.pnl).toFixed(2)}`
  return `${day.date}\nP&L: ${pnlLabel}\nTrades: ${day.tradeCount}\nWin rate: ${day.winRate}%`
}
