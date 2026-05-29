/** Week starts Sunday (forex Sunday planning convention). */

export function getWeekStartSunday(date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export function formatWeekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const fmt = (dt: Date) =>
    dt.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  return `${fmt(start)} – ${fmt(end)}`
}

export const FOREX_PAIRS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "XAUUSD",
] as const
