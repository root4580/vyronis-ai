"use client"

import { useState, useEffect } from "react"
import {
  TrendingUp,
  TrendingDown,
  Brain,
  Shield,
  Target,
  Activity,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Percent,
  DollarSign,
  Calendar,
  Pencil,
  Trash2,
  Bell,
  LayoutDashboard,
  BookOpen,
  Lightbulb,
  ChevronDown,
  Sparkles,
  Image as ImageIcon,
  X,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from "recharts"

// Daily rules checklist
const dailyRules = [
  { id: 1, rule: "Pre-market analysis completed", checked: true },
  { id: 2, rule: "Risk per trade ≤ 1%", checked: true },
  { id: 3, rule: "Max 3 trades per session", checked: true },
  { id: 4, rule: "No revenge trading", checked: true },
  { id: 5, rule: "Stop loss on every trade", checked: true },
  { id: 6, rule: "Journal entry after each trade", checked: false },
]

type Trade = {
  id: string
  pair: string
  direction: string
  result: string
  pnl: number
  emotion: string
  setup: string
  strategy_name: string | null
  risk_percent: number | null
  rule_followed: boolean | null
  user_id: string | null
  trade_date: string | null
  higher_timeframe: string | null
  entry_timeframe: string | null
  confirmation_timeframe: string | null
  confirmation_signal: string | null
  session: string | null
  screenshot_url: string | null
  created_at: string
}

// Session detection types and helpers
type SessionInfo = {
  name: string
  color: string
  glowClass: string
  borderClass: string
  bgClass: string
  textClass: string
  isActive: boolean
}

function getESTTime(): Date {
  const now = new Date()
  // Convert to EST (UTC-5) or EDT (UTC-4) depending on daylight saving
  const estOffset = -5
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
  return new Date(utc + (3600000 * estOffset))
}

function detectTradingSession(): SessionInfo {
  const estTime = getESTTime()
  const hour = estTime.getHours()
  const minutes = estTime.getMinutes()
  const day = estTime.getDay() // 0 = Sunday, 6 = Saturday
  const totalMinutes = hour * 60 + minutes
  
  // Weekend check (Saturday or Sunday)
  if (day === 0 || day === 6) {
    return {
      name: "Market Closed",
      color: "loss",
      glowClass: "",
      borderClass: "border-loss/30",
      bgClass: "bg-loss/10",
      textClass: "text-loss",
      isActive: false,
    }
  }
  
  // Session times in minutes from midnight EST
  const asiaStart = 19 * 60 // 7 PM EST
  const asiaEnd = 4 * 60 // 4 AM EST (next day)
  const londonStart = 3 * 60 // 3 AM EST
  const londonEnd = 12 * 60 // 12 PM EST
  const nyStart = 8 * 60 // 8 AM EST
  const nyEnd = 17 * 60 // 5 PM EST
  const overlapStart = 8 * 60 // 8 AM EST
  const overlapEnd = 12 * 60 // 12 PM EST
  
  // Check London + New York Overlap first (most specific)
  if (totalMinutes >= overlapStart && totalMinutes < overlapEnd) {
    return {
      name: "London + NY Overlap",
      color: "profit",
      glowClass: "glow-profit",
      borderClass: "border-profit/30",
      bgClass: "bg-profit/10",
      textClass: "text-profit",
      isActive: true,
    }
  }
  
  // New York Session (8 AM - 5 PM EST)
  if (totalMinutes >= nyStart && totalMinutes < nyEnd) {
    return {
      name: "New York Session",
      color: "cyan-glow",
      glowClass: "glow-cyan",
      borderClass: "border-cyan-glow/30",
      bgClass: "bg-cyan-glow/10",
      textClass: "text-cyan-glow",
      isActive: true,
    }
  }
  
  // London Session (3 AM - 12 PM EST, excluding overlap which is handled above)
  if (totalMinutes >= londonStart && totalMinutes < londonEnd) {
    return {
      name: "London Session",
      color: "amber",
      glowClass: "",
      borderClass: "border-amber-500/30",
      bgClass: "bg-amber-500/10",
      textClass: "text-amber-500",
      isActive: true,
    }
  }
  
  // Asia Session (7 PM - 4 AM EST, spans midnight)
  if (totalMinutes >= asiaStart || totalMinutes < asiaEnd) {
    return {
      name: "Asia Session",
      color: "purple",
      glowClass: "",
      borderClass: "border-purple-500/30",
      bgClass: "bg-purple-500/10",
      textClass: "text-purple-500",
      isActive: true,
    }
  }
  
  // Market Closed (outside all session hours)
  return {
    name: "Market Closed",
    color: "loss",
    glowClass: "",
    borderClass: "border-loss/30",
    bgClass: "bg-loss/10",
    textClass: "text-loss",
    isActive: false,
  }
}

export function DashboardHeader() {
  const [session, setSession] = useState<SessionInfo>(detectTradingSession())
  const [localTime, setLocalTime] = useState<string>("")
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  
  useEffect(() => {
    // Update session and time every second
    const updateTime = () => {
      setSession(detectTradingSession())
      setLocalTime(new Date().toLocaleTimeString("en-US", { 
        hour: "numeric", 
        minute: "2-digit",
        hour12: true 
      }))
    }
    
    updateTime() // Initial call
    const interval = setInterval(updateTime, 1000)
    
    return () => clearInterval(interval)
  }, [])

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/", active: true },
    { label: "Strategies", icon: Target, href: "/strategy" },
    { label: "Analytics", icon: BarChart3, href: "#" },
    { label: "Journal", icon: BookOpen, href: "#" },
    { label: "AI Insights", icon: Lightbulb, href: "#" },
  ]
  
  return (
    <header className="glass-card border-b border-border/50 sticky top-0 z-30">
      <div className="px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative size-9 rounded-lg bg-gradient-to-br from-cyan-glow/20 to-profit/20 flex items-center justify-center glow-cyan">
              <Zap className="size-5 text-cyan-glow" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold tracking-tight leading-none">Vyronis AI</h1>
              <p className="text-[10px] text-muted-foreground">AI Trading Intelligence</p>
            </div>
          </div>

          {/* Navigation - Hidden on mobile */}
          <nav className="hidden lg:flex items-center gap-1 bg-secondary/30 rounded-lg p-1 border border-border/30">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                  item.active 
                    ? "bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Live Session Badge */}
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs">
                {session.isActive ? (
                  <div className={`size-1.5 rounded-full ${session.textClass.replace("text-", "bg-")} animate-pulse`} />
                ) : (
                  <div className="size-1.5 rounded-full bg-loss" />
                )}
                <span className="text-muted-foreground">{session.isActive ? "Live" : "Closed"}</span>
              </div>
              <Badge variant="outline" className={`text-xs ${session.borderClass} ${session.textClass} ${session.bgClass} ${session.glowClass} transition-all duration-300`}>
                <Clock className="mr-1 size-3" />
                <span className="hidden xl:inline">{session.name}</span>
                <span className="xl:hidden">{session.name.split(" ")[0]}</span>
                {localTime && <span className="ml-1.5 text-muted-foreground hidden xl:inline">• {localTime}</span>}
              </Badge>
            </div>
            
            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-secondary/50 border border-transparent hover:border-border/50 transition-all group">
              <Bell className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="absolute -top-0.5 -right-0.5 size-4 bg-loss text-[10px] font-bold rounded-full flex items-center justify-center text-white">
                3
              </span>
            </button>

            {/* Premium Badge */}
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/30">
              <Sparkles className="size-3 text-amber-500" />
              <span className="text-xs font-medium text-amber-500">PRO</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Navigation Bar */}
      <div className="lg:hidden border-t border-border/30">
        <nav className="flex items-center justify-around px-2 py-1.5">
          {navItems.slice(0, 4).map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all ${
                item.active 
                  ? "text-cyan-glow" 
                  : "text-muted-foreground"
              }`}
            >
              <item.icon className="size-5" />
              <span className="text-[10px]">{item.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}

export function StatsCards({ totalPnL, winRate, tradeCount, avgRisk, startingBalance, accountBalance }: { totalPnL?: number; winRate?: number; tradeCount?: number; avgRisk?: number; startingBalance?: number; accountBalance?: number }) {
  const baseBalance = startingBalance || 10000
  const currentBalance = accountBalance !== undefined ? accountBalance : baseBalance
  const roiPercent = totalPnL !== undefined && baseBalance > 0 ? ((totalPnL / baseBalance) * 100).toFixed(1) : "0"
  
  const stats = [
    {
      title: "Account Balance",
      value: `$${currentBalance.toLocaleString()}`,
      change: `${parseFloat(roiPercent) >= 0 ? "+" : ""}${roiPercent}%`,
      trend: totalPnL !== undefined ? (totalPnL >= 0 ? "up" : "down") : "up",
      icon: DollarSign,
    },
    {
      title: "Total P&L",
      value: totalPnL !== undefined ? `${totalPnL >= 0 ? "+" : ""}$${totalPnL.toFixed(2)}` : "$0",
      change: tradeCount !== undefined ? `${tradeCount} trades` : "0 trades",
      trend: totalPnL !== undefined ? (totalPnL >= 0 ? "up" : "down") : "up",
      icon: TrendingUp,
    },
    {
      title: "Win Rate",
      value: winRate !== undefined ? `${winRate}%` : "0%",
      change: winRate !== undefined ? (winRate >= 50 ? "Profitable" : "Needs work") : "No trades",
      trend: winRate !== undefined ? (winRate >= 50 ? "up" : "down") : "up",
      icon: Target,
    },
    {
      title: "Avg. Risk",
      value: avgRisk !== undefined ? `${avgRisk.toFixed(2)}%` : "1%",
      change: avgRisk !== undefined ? (avgRisk <= 1 ? "Within limits" : "Risk too high") : "No trades",
      trend: avgRisk !== undefined ? (avgRisk <= 1 ? "up" : "down") : "up",
      icon: BarChart3,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index} className="glass-card border-border/50 hover:border-cyan-glow/20 transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{stat.title}</p>
                <p className="mt-1 text-2xl font-bold">{stat.value}</p>
                <div className="mt-1 flex items-center gap-1">
                  {stat.trend === "up" ? (
                    <TrendingUp className="size-3 text-profit" />
                  ) : (
                    <TrendingDown className="size-3 text-loss" />
                  )}
                  <span className={`text-xs ${stat.trend === "up" ? "text-profit" : "text-loss"}`}>
                    {stat.change}
                  </span>
                </div>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <stat.icon className="size-5 text-cyan-glow" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function EquityCurveChart({ trades, startingBalance }: { trades?: Trade[]; startingBalance?: number }) {
  const baseBalance = startingBalance || 10000
  const hasTrades = trades && trades.length > 0
  
  // Calculate cumulative equity from trades (sorted chronologically)
  const equityData = hasTrades 
    ? [...trades]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((trade, index, arr) => {
          const cumulativePnL = arr.slice(0, index + 1).reduce((sum, t) => sum + t.pnl, 0)
          const equity = baseBalance + cumulativePnL
          const date = new Date(trade.created_at)
          return {
            date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            equity,
            pnl: trade.pnl,
          }
        })
    : []
  
  const totalPnL = hasTrades ? trades.reduce((sum, t) => sum + t.pnl, 0) : 0
  const roiPercent = baseBalance > 0 ? ((totalPnL / baseBalance) * 100).toFixed(1) : "0"
  
  return (
    <Card className="glass-card border-border/50 col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="size-4 text-cyan-glow" />
            Equity Curve
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasTrades ? (
              <Badge variant="outline" className={`text-xs ${totalPnL >= 0 ? "border-profit/30 text-profit bg-profit/10" : "border-loss/30 text-loss bg-loss/10"}`}>
                {totalPnL >= 0 ? "+" : ""}{roiPercent}% Total
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">No data</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-64">
        {!hasTrades ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Activity className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No trades to display</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Add trades to see your equity curve</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityData}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.7 0.15 195)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="oklch(0.7 0.15 195)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} />
              <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(12, 14, 20, 0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, "Equity"]}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="oklch(0.7 0.15 195)"
                strokeWidth={2}
                fill="url(#equityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function WeeklyPerformance({ trades }: { trades?: Trade[] }) {
  const hasTrades = trades && trades.length > 0
  
  // Group trades by weekday
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const weeklyData = hasTrades 
    ? weekdays.map((day, index) => {
        const dayTrades = trades.filter(t => new Date(t.created_at).getDay() === index)
        const pnl = dayTrades.reduce((sum, t) => sum + t.pnl, 0)
        return { day, pnl, trades: dayTrades.length }
      }).filter(d => d.trades > 0) // Only show days with trades
    : []
  
  const hasWeeklyData = weeklyData.length > 0
  
  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="size-4 text-cyan-glow" />
          Weekly Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {!hasWeeklyData ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Calendar className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No weekly data</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Trade performance will appear here</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} />
              <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(12, 14, 20, 0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => [
                  `$${value.toFixed(2)}`,
                  name === "pnl" ? "P&L" : name
                ]}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {weeklyData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.pnl >= 0 ? "oklch(0.7 0.18 155)" : "oklch(0.55 0.2 25)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function RecentTradesTable({ trades, onEdit, onDelete, onImageClick }: { trades?: Trade[]; onEdit?: (trade: Trade) => void; onDelete?: (trade: Trade) => void; onImageClick?: (url: string) => void }) {
  const hasTrades = trades && trades.length > 0
  
  return (
    <Card className="glass-card border-border/50 col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="size-4 text-cyan-glow" />
            Recent Trades
          </CardTitle>
          <Badge variant="outline" className="text-xs">{hasTrades ? `${trades.length} trades` : "0 trades"}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!hasTrades ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No trades logged yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="pb-3 text-left font-medium">Pair</th>
                <th className="pb-3 text-left font-medium hidden sm:table-cell">Dir</th>
                <th className="pb-3 text-left font-medium hidden md:table-cell">Session</th>
                <th className="pb-3 text-right font-medium">P&L</th>
                <th className="pb-3 text-right font-medium hidden sm:table-cell">Result</th>
                <th className="pb-3 text-center font-medium">Chart</th>
                <th className="pb-3 text-right font-medium hidden lg:table-cell">Date</th>
                {(onEdit || onDelete) && <th className="pb-3 text-right font-medium">Actions</th>}
              </tr>
              </thead>
              <tbody>
                {trades.slice(0, 10).map((trade) => (
                  <tr key={trade.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="py-3 font-medium">{trade.pair}</td>
                    <td className="py-3 hidden sm:table-cell">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          trade.direction === "BUY"
                            ? "border-profit/30 text-profit bg-profit/10"
                            : "border-loss/30 text-loss bg-loss/10"
                        }`}
                      >
                        {trade.direction}
                      </Badge>
                    </td>
                    <td className="py-3 text-cyan-glow text-xs hidden md:table-cell">
                      {trade.session || "-"}
                    </td>
                    <td className={`py-3 text-right font-medium ${trade.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                      {trade.pnl >= 0 ? "+" : ""}${trade.pnl}
                    </td>
                    <td className="py-3 text-right hidden sm:table-cell">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          trade.result === "WIN"
                            ? "border-profit/30 text-profit bg-profit/10"
                            : trade.result === "LOSS"
                            ? "border-loss/30 text-loss bg-loss/10"
                            : "border-muted/30 text-muted-foreground bg-muted/10"
                        }`}
                      >
                        {trade.result}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <div className="flex justify-center">
                        {trade.screenshot_url ? (
                          <button
                            onClick={() => onImageClick?.(trade.screenshot_url!)}
                            className="relative group rounded-md overflow-hidden border border-border/30 hover:border-cyan-glow/50 transition-all"
                            title="View chart screenshot"
                          >
                            <img 
                              src={trade.screenshot_url} 
                              alt={`${trade.pair} chart`}
                              className="size-10 object-cover"
                            />
                            <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ImageIcon className="size-4 text-cyan-glow" />
                            </div>
                          </button>
                        ) : (
                          <div className="size-10 rounded-md border border-border/20 bg-secondary/10 flex items-center justify-center" title="No screenshot">
                            <ImageIcon className="size-4 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-right text-muted-foreground hidden lg:table-cell">
                      {new Date(trade.trade_date || trade.created_at).toLocaleDateString()}
                    </td>
                    {(onEdit || onDelete) && (
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {onEdit && (
                            <button
                              onClick={() => onEdit(trade)}
                              className="p-1.5 rounded-md hover:bg-cyan-glow/10 border border-transparent hover:border-cyan-glow/20 transition-all group"
                              title="Edit trade"
                            >
                              <Pencil className="size-3.5 text-muted-foreground group-hover:text-cyan-glow transition-colors" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(trade)}
                              className="p-1.5 rounded-md hover:bg-loss/10 border border-transparent hover:border-loss/20 transition-all group"
                              title="Delete trade"
                            >
                              <Trash2 className="size-3.5 text-muted-foreground group-hover:text-loss transition-colors" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AIPsychologyInsights({ trades }: { trades?: Trade[] }) {
  const hasTrades = trades && trades.length > 0
  
  // Analyze psychology from real trades
  const analysis = hasTrades ? (() => {
    const emotionCounts = trades.reduce((acc, t) => {
      acc[t.emotion] = (acc[t.emotion] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const totalTrades = trades.length
    const losses = trades.filter(t => t.result === "LOSS")
    const wins = trades.filter(t => t.result === "WIN")
    const rulesFollowed = trades.filter(t => t.rule_followed === true).length
    
    // Detect revenge trading (loss followed by quick trade with FOMO/Revenge emotion)
    const revengeCount = trades.filter(t => t.emotion === "Revenge").length
    const fomoCount = trades.filter(t => t.emotion === "FOMO").length
    const calmCount = emotionCounts["Calm"] || 0
    const disciplinedCount = emotionCounts["Disciplined"] || 0
    
    // Calculate scores (0-100)
    const emotionalStability = Math.max(0, Math.min(100, Math.round(
      ((calmCount + disciplinedCount) / totalTrades) * 100
    )))
    
    const fomoResistance = Math.max(0, Math.min(100, Math.round(
      100 - ((fomoCount + revengeCount) / totalTrades) * 100
    )))
    
    const disciplineScore = Math.max(0, Math.min(100, Math.round(
      (rulesFollowed / totalTrades) * 100
    )))
    
    // Generate insight text
    const insights: string[] = []
    
    if (revengeCount > 0) {
      insights.push(`Detected ${revengeCount} revenge trade${revengeCount > 1 ? "s" : ""} - this pattern often leads to larger losses.`)
    }
    if (fomoCount > 0) {
      insights.push(`FOMO triggered ${fomoCount} trade${fomoCount > 1 ? "s" : ""} - consider waiting for A+ setups.`)
    }
    if (disciplineScore >= 80) {
      insights.push("Excellent discipline - you're following your rules consistently.")
    } else if (disciplineScore < 50) {
      insights.push("Rule adherence is below 50% - focus on trading your plan.")
    }
    if (losses.length > wins.length && losses.length >= 3) {
      insights.push("Losing streak detected - consider taking a break to reset.")
    }
    if (emotionalStability >= 70) {
      insights.push("Strong emotional control in recent trades.")
    }
    if (insights.length === 0) {
      insights.push("Keep logging trades to unlock personalized psychology insights.")
    }
    
    return {
      emotionalStability,
      fomoResistance,
      disciplineScore,
      insight: insights[0]
    }
  })() : null
  
  return (
    <Card className="glass-card border-border/50 animated-border overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className="size-4 text-cyan-glow" />
          AI Psychology Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasTrades ? (
          <div className="text-center py-6">
            <Brain className="size-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No data to analyze</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Log trades to unlock AI insights</p>
          </div>
        ) : (
          <>
            <div className="rounded-lg bg-secondary/30 p-3 border border-cyan-glow/10">
              <p className="text-sm text-muted-foreground">
                {analysis?.insight}
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Emotional Stability</span>
                <span className={`text-xs font-medium ${(analysis?.emotionalStability || 0) >= 70 ? "text-profit" : (analysis?.emotionalStability || 0) >= 50 ? "text-cyan-glow" : "text-loss"}`}>{analysis?.emotionalStability || 0}%</span>
              </div>
              <Progress value={analysis?.emotionalStability || 0} className="h-1.5 bg-secondary" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">FOMO Resistance</span>
                <span className={`text-xs font-medium ${(analysis?.fomoResistance || 0) >= 70 ? "text-profit" : (analysis?.fomoResistance || 0) >= 50 ? "text-cyan-glow" : "text-loss"}`}>{analysis?.fomoResistance || 0}%</span>
              </div>
              <Progress value={analysis?.fomoResistance || 0} className="h-1.5 bg-secondary" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Discipline Score</span>
                <span className={`text-xs font-medium ${(analysis?.disciplineScore || 0) >= 70 ? "text-profit" : (analysis?.disciplineScore || 0) >= 50 ? "text-cyan-glow" : "text-loss"}`}>{analysis?.disciplineScore || 0}%</span>
              </div>
              <Progress value={analysis?.disciplineScore || 0} className="h-1.5 bg-secondary" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function DisciplineScore() {
  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="size-4 text-cyan-glow" />
          Discipline Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-4">
          <div className="relative size-32">
            <svg className="size-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="oklch(0.7 0.15 195)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${87 * 2.51} ${100 * 2.51}`}
                className="drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">87</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Rules followed</span>
            <span className="text-profit">5/6</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Risk managed</span>
            <span className="text-profit">100%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Journal entries</span>
            <span className="text-yellow-500">83%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RiskManagement() {
  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="size-4 text-cyan-glow" />
          Risk Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-secondary/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">Max Drawdown</p>
            <p className="mt-1 text-lg font-bold text-loss">-5.2%</p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">Risk per Trade</p>
            <p className="mt-1 text-lg font-bold text-profit">0.8%</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Daily Risk Used</span>
            <span>1.6% / 3%</span>
          </div>
          <Progress value={53} className="h-1.5 bg-secondary" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Weekly Risk Used</span>
            <span>4.2% / 10%</span>
          </div>
          <Progress value={42} className="h-1.5 bg-secondary" />
        </div>
      </CardContent>
    </Card>
  )
}

export function EmotionalStateTracker() {
  const emotions = [
    { state: "Confident", level: 75, color: "bg-profit" },
    { state: "Focused", level: 82, color: "bg-cyan-glow" },
    { state: "Patient", level: 88, color: "bg-profit" },
    { state: "Anxious", level: 15, color: "bg-loss" },
  ]

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="size-4 text-cyan-glow" />
          Emotional State
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {emotions.map((emotion) => (
          <div key={emotion.state} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{emotion.state}</span>
              <span>{emotion.level}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary">
              <div
                className={`h-full rounded-full ${emotion.color} transition-all duration-500`}
                style={{ width: `${emotion.level}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function DailyRulesChecklist() {
  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="size-4 text-cyan-glow" />
          Daily Trading Rules
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {dailyRules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-3">
              <Checkbox
                id={`rule-${rule.id}`}
                checked={rule.checked}
                className="border-border data-[state=checked]:bg-profit data-[state=checked]:border-profit"
              />
              <label
                htmlFor={`rule-${rule.id}`}
                className={`text-sm ${rule.checked ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                {rule.rule}
              </label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function WinRateAnalytics({ winRate, tradeCount, totalPnL }: { winRate?: number; tradeCount?: number; totalPnL?: number }) {
  const actualWinRate = winRate ?? 0
  const actualTradeCount = tradeCount ?? 0
  const lossCount = actualTradeCount - Math.round(actualTradeCount * (actualWinRate / 100))
  const winCount = actualTradeCount - lossCount
  
  const chartData = [
    { name: "Wins", value: winCount || 1, color: "var(--profit)" },
    { name: "Losses", value: lossCount || 1, color: "var(--loss)" },
  ]
  
  // Calculate profit factor (total wins / total losses)
  const profitFactor = totalPnL !== undefined && totalPnL > 0 ? (totalPnL / Math.max(1, lossCount)).toFixed(2) : "0.00"
  
  return (
  <Card className="glass-card border-border/50">
  <CardHeader className="pb-2">
  <CardTitle className="text-sm font-medium flex items-center gap-2">
  <Percent className="size-4 text-cyan-glow" />
  Win Rate Analytics
  </CardTitle>
  </CardHeader>
  <CardContent>
  <div className="flex items-center justify-center py-2">
  <div className="relative size-28">
  <ResponsiveContainer width="100%" height="100%">
  <PieChart>
  <Pie
  data={chartData}
  cx="50%"
  cy="50%"
  innerRadius={35}
  outerRadius={50}
  paddingAngle={2}
  dataKey="value"
  >
  {chartData.map((entry, index) => (
  <Cell key={`cell-${index}`} fill={entry.color} />
  ))}
  </Pie>
  </PieChart>
  </ResponsiveContainer>
  <div className="absolute inset-0 flex flex-col items-center justify-center">
  <span className="text-xl font-bold">{actualWinRate}%</span>
  <span className="text-[10px] text-muted-foreground">Win Rate</span>
  </div>
  </div>
  </div>
  <div className="mt-4 grid grid-cols-2 gap-4 text-center text-xs">
  <div>
  <p className="text-muted-foreground">Total Trades</p>
  <p className="mt-1 text-lg font-bold">{actualTradeCount}</p>
  </div>
  <div>
  <p className="text-muted-foreground">Profit Factor</p>
  <p className="mt-1 text-lg font-bold text-profit">{profitFactor}</p>
  </div>
  </div>
      </CardContent>
    </Card>
  )
}

// Premium Placeholder Components with Cyberpunk Loading States
export function CalendarHeatmapPlaceholder({ trades }: { trades?: Trade[] }) {
  const safeTradesArray = trades || []
  
  // Generate last 5 weeks of data
  const today = new Date()
  const fiveWeeksAgo = new Date(today)
  fiveWeeksAgo.setDate(today.getDate() - 34)
  
  // Create a map of date -> pnl
  const dateMap = new Map<string, number>()
  safeTradesArray.forEach(trade => {
    const date = trade.trade_date || trade.created_at.split('T')[0]
    const current = dateMap.get(date) || 0
    dateMap.set(date, current + trade.pnl)
  })
  
  // Generate 35 days (5 weeks)
  const days = Array.from({ length: 35 }, (_, i) => {
    const date = new Date(fiveWeeksAgo)
    date.setDate(fiveWeeksAgo.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]
    const pnl = dateMap.get(dateStr) || 0
    const isToday = dateStr === today.toISOString().split('T')[0]
    return { date: dateStr, pnl, isToday, dayNum: date.getDate() }
  })

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  
  const getIntensity = (pnl: number) => {
    if (pnl === 0) return 'bg-secondary/30'
    if (pnl > 0) {
      if (pnl > 200) return 'bg-profit/80 border-profit/50'
      if (pnl > 100) return 'bg-profit/60 border-profit/40'
      if (pnl > 50) return 'bg-profit/40 border-profit/30'
      return 'bg-profit/20 border-profit/20'
    } else {
      if (pnl < -200) return 'bg-loss/80 border-loss/50'
      if (pnl < -100) return 'bg-loss/60 border-loss/40'
      if (pnl < -50) return 'bg-loss/40 border-loss/30'
      return 'bg-loss/20 border-loss/20'
    }
  }

  return (
    <Card className="glass-card border-border/50 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-glow/5 via-transparent to-profit/5" />
      <CardHeader className="pb-2 relative">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="size-4 text-cyan-glow" />
          Performance Heatmap
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="space-y-2">
          {/* Week day labels */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekDays.map((day, i) => (
              <div key={i} className="text-[10px] text-muted-foreground text-center">{day}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => (
              <div
                key={i}
                className={`aspect-square rounded-sm border transition-all hover:scale-110 cursor-pointer flex items-center justify-center text-[8px] ${getIntensity(day.pnl)} ${day.isToday ? 'ring-1 ring-cyan-glow' : 'border-transparent'}`}
                title={`${day.date}: ${day.pnl >= 0 ? '+' : ''}$${day.pnl.toFixed(0)}`}
              >
                {day.isToday && <span className="text-foreground font-bold">{day.dayNum}</span>}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center justify-between pt-2 text-[10px] text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="size-3 rounded-sm bg-loss/60" />
              <div className="size-3 rounded-sm bg-loss/30" />
              <div className="size-3 rounded-sm bg-secondary/30" />
              <div className="size-3 rounded-sm bg-profit/30" />
              <div className="size-3 rounded-sm bg-profit/60" />
            </div>
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AITradeCoachPlaceholder({ trades }: { trades?: Trade[] }) {
  const safeTradesArray = trades || []
  
  // Generate coaching insights based on trade data
  const getCoachingInsights = () => {
    if (safeTradesArray.length === 0) {
      return [
        { type: 'info', message: 'Start logging trades to receive AI coaching insights', icon: Brain },
        { type: 'tip', message: 'Consistency is key - aim to journal every trade', icon: Target },
      ]
    }
    
    const insights: { type: string; message: string; icon: typeof Brain }[] = []
    
    // Check rule violations
    const violations = safeTradesArray.filter(t => t.rule_followed === false)
    if (violations.length > 0) {
      insights.push({
        type: 'warning',
        message: `${violations.length} trades broke your rules. Review before next session.`,
        icon: AlertTriangle
      })
    }
    
    // Check risk management
    const highRisk = safeTradesArray.filter(t => (t.risk_percent || 1) > 1)
    if (highRisk.length > safeTradesArray.length * 0.3) {
      insights.push({
        type: 'warning',
        message: 'Over-risking detected. Consider scaling back position sizes.',
        icon: Shield
      })
    }
    
    // Check emotional patterns
    const emotionalTrades = safeTradesArray.filter(t => 
      ['FOMO', 'Fear', 'Revenge', 'Greed'].includes(t.emotion)
    )
    if (emotionalTrades.length > 0) {
      const lossesDueToEmotion = emotionalTrades.filter(t => t.result === 'LOSS').length
      if (lossesDueToEmotion > emotionalTrades.length * 0.5) {
        insights.push({
          type: 'insight',
          message: 'Emotional trades are costing you. Practice detachment.',
          icon: Brain
        })
      }
    }
    
    // Check win streaks
    const recentTrades = safeTradesArray.slice(-5)
    const recentWins = recentTrades.filter(t => t.result === 'WIN').length
    if (recentWins >= 4) {
      insights.push({
        type: 'success',
        message: 'Great streak! Stay disciplined and avoid overconfidence.',
        icon: CheckCircle2
      })
    }
    
    // Default encouraging message
    if (insights.length === 0) {
      insights.push({
        type: 'success',
        message: 'Solid discipline today. Keep following your process.',
        icon: CheckCircle2
      })
    }
    
    return insights.slice(0, 2)
  }
  
  const insights = getCoachingInsights()

  const typeStyles: Record<string, string> = {
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-500',
    success: 'bg-profit/10 border-profit/30 text-profit',
    insight: 'bg-cyan-glow/10 border-cyan-glow/30 text-cyan-glow',
    info: 'bg-secondary/30 border-border/30 text-muted-foreground',
    tip: 'bg-profit/10 border-profit/30 text-profit',
  }

  return (
    <Card className="glass-card border-border/50 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-profit/5 via-transparent to-cyan-glow/5" />
      <CardHeader className="pb-2 relative">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className="size-4 text-profit" />
          AI Trade Coach
          <Badge variant="outline" className="text-[10px] bg-profit/10 text-profit border-profit/30 ml-auto">LIVE</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div key={i} className={`rounded-lg p-3 border ${typeStyles[insight.type]} transition-all`}>
              <div className="flex gap-2">
                <insight.icon className="size-4 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">{insight.message}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function StreakTrackerPlaceholder({ trades }: { trades?: Trade[] }) {
  const safeTradesArray = trades || []
  
  // Calculate current streak
  const calculateStreak = () => {
    if (safeTradesArray.length === 0) return { count: 0, type: 'neutral' }
    
    const sorted = [...safeTradesArray].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    
    let streak = 0
    const firstResult = sorted[0]?.result
    
    for (const trade of sorted) {
      if (trade.result === firstResult) {
        streak++
      } else {
        break
      }
    }
    
    return { 
      count: streak, 
      type: firstResult === 'WIN' ? 'win' : firstResult === 'LOSS' ? 'loss' : 'neutral' 
    }
  }
  
  const streak = calculateStreak()
  
  // Get last 7 trade results
  const lastSeven = safeTradesArray.slice(-7).map(t => t.result)
  while (lastSeven.length < 7) {
    lastSeven.unshift('PENDING')
  }

  const streakColors: Record<string, string> = {
    win: 'text-profit',
    loss: 'text-loss',
    neutral: 'text-muted-foreground'
  }

  const resultColors: Record<string, string> = {
    WIN: 'bg-profit/60 border-profit/30',
    LOSS: 'bg-loss/60 border-loss/30',
    BE: 'bg-secondary/60 border-border/30',
    PENDING: 'bg-secondary/30 border-border/20',
  }

  return (
    <Card className="glass-card border-border/50 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-cyan-glow/5" />
      <CardHeader className="pb-2 relative">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="size-4 text-amber-500" />
          Streak Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="space-y-4">
          {/* Last 7 trades visualization */}
          <div className="flex items-center justify-center gap-1.5">
            {lastSeven.map((result, i) => (
              <div
                key={i}
                className={`size-8 rounded-lg border flex items-center justify-center transition-transform hover:scale-110 ${resultColors[result]}`}
              >
                {result === 'WIN' && <TrendingUp className="size-4 text-profit" />}
                {result === 'LOSS' && <TrendingDown className="size-4 text-loss" />}
                {result === 'BE' && <div className="size-2 rounded-full bg-muted-foreground" />}
                {result === 'PENDING' && <div className="size-2 rounded-full bg-border" />}
              </div>
            ))}
          </div>
          {/* Current streak display */}
          <div className="text-center space-y-1">
            <div className={`text-3xl font-bold ${streakColors[streak.type]}`}>
              {streak.count > 0 ? streak.count : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {streak.count === 0 
                ? 'No active streak' 
                : `${streak.type === 'win' ? 'Win' : 'Loss'} Streak`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function QuantumAnalyticsPlaceholder({ trades }: { trades?: Trade[] }) {
  const safeTradesArray = trades || []
  
  // Calculate pattern recognition data
  const patterns = {
    bestSetup: 'A+ Setup',
    bestSession: 'London',
    winningEmotion: 'Calm',
    topStrategy: 'ICT/SMC',
  }
  
  if (safeTradesArray.length > 0) {
    // Find best performing setup
    const setupStats = new Map<string, { wins: number; total: number }>()
    safeTradesArray.forEach(t => {
      const setup = t.setup || 'Unknown'
      const current = setupStats.get(setup) || { wins: 0, total: 0 }
      current.total++
      if (t.result === 'WIN') current.wins++
      setupStats.set(setup, current)
    })
    
    let bestSetupRate = 0
    setupStats.forEach((stats, setup) => {
      const rate = stats.total > 0 ? stats.wins / stats.total : 0
      if (rate > bestSetupRate && stats.total >= 2) {
        bestSetupRate = rate
        patterns.bestSetup = setup
      }
    })
    
    // Find best session
    const sessionStats = new Map<string, { pnl: number; count: number }>()
    safeTradesArray.forEach(t => {
      const session = t.session || 'Unknown'
      const current = sessionStats.get(session) || { pnl: 0, count: 0 }
      current.pnl += t.pnl
      current.count++
      sessionStats.set(session, current)
    })
    
    let bestSessionPnl = -Infinity
    sessionStats.forEach((stats, session) => {
      if (stats.pnl > bestSessionPnl && stats.count >= 2) {
        bestSessionPnl = stats.pnl
        patterns.bestSession = session
      }
    })
  }

  const patternItems = [
    { label: 'Best Setup', value: patterns.bestSetup, color: 'text-cyan-glow' },
    { label: 'Best Session', value: patterns.bestSession, color: 'text-profit' },
    { label: 'Win Emotion', value: patterns.winningEmotion, color: 'text-amber-500' },
    { label: 'Top Strategy', value: patterns.topStrategy, color: 'text-purple-400' },
  ]

  return (
    <Card className="glass-card border-border/50 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-glow/5" />
      <CardHeader className="pb-2 relative">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="size-4 text-purple-400" />
          Pattern Recognition
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="grid grid-cols-2 gap-2">
          {patternItems.map((item, i) => (
            <div key={i} className="rounded-lg bg-secondary/20 border border-border/30 p-2 transition-all hover:border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className={`text-sm font-medium truncate ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function SessionStats({ trades }: { trades?: Trade[] }) {
  const hasTrades = trades && trades.length > 0
  
  // Calculate session analytics
  const sessionAnalytics = hasTrades ? (() => {
    const sessionMap = new Map<string, { pnl: number; wins: number; total: number }>()
    
    trades.forEach(trade => {
      const session = trade.session || "Unknown"
      const existing = sessionMap.get(session) || { pnl: 0, wins: 0, total: 0 }
      sessionMap.set(session, {
        pnl: existing.pnl + trade.pnl,
        wins: existing.wins + (trade.result === "WIN" ? 1 : 0),
        total: existing.total + 1,
      })
    })
    
    // Find best performing session
    let bestSession = { name: "-", pnl: 0, winRate: 0 }
    sessionMap.forEach((data, name) => {
      if (data.pnl > bestSession.pnl) {
        bestSession = {
          name,
          pnl: data.pnl,
          winRate: Math.round((data.wins / data.total) * 100),
        }
      }
    })
    
    // Get all sessions with stats
    const sessionList = Array.from(sessionMap.entries()).map(([name, data]) => ({
      name,
      pnl: data.pnl,
      winRate: Math.round((data.wins / data.total) * 100),
      total: data.total,
    })).sort((a, b) => b.pnl - a.pnl)
    
    return { bestSession, sessionList }
  })() : null
  
  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="size-4 text-cyan-glow" />
          Session Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasTrades || !sessionAnalytics ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">No session data yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Best Performing Session */}
            <div className="rounded-lg bg-gradient-to-r from-profit/10 to-cyan-glow/10 p-3 border border-profit/20">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Best Session</p>
              <p className="text-lg font-bold text-profit">{sessionAnalytics.bestSession.name}</p>
              <div className="flex items-center gap-3 mt-1 text-xs">
                <span className="text-profit">+${sessionAnalytics.bestSession.pnl.toFixed(0)}</span>
                <span className="text-muted-foreground">{sessionAnalytics.bestSession.winRate}% WR</span>
              </div>
            </div>
            
            {/* Session Breakdown */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Win Rate by Session</p>
              {sessionAnalytics.sessionList.slice(0, 4).map((session) => (
                <div key={session.name} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{session.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={session.pnl >= 0 ? "text-profit" : "text-loss"}>
                      {session.pnl >= 0 ? "+" : ""}${session.pnl.toFixed(0)}
                    </span>
                    <span className={`font-medium ${session.winRate >= 50 ? "text-profit" : "text-loss"}`}>
                      {session.winRate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
