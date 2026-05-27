"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState, useEffect, useCallback, type ReactNode } from "react"
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
  ChevronDown,
  ChevronUp,
  Search,
  ArrowUpDown,
  Settings,
  Sparkles,
  Flame,
  Eye,
  Image as ImageIcon,
  X,
  FlaskConical,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DashboardCard,
  DashboardCardHeader,
  DashboardCardBody,
  DashboardEmptyState,
  DashboardMetricLabel,
  DashboardStatIcon,
  DashboardInsetPanel,
  CHART_AXIS,
  CHART_GRID,
  CHART_TOOLTIP_STYLE,
} from "@/components/dashboard/dashboard-primitives"
import { formatPnL, getPnLTextClass, getSignedPnL } from "@/lib/trade-utils"
import {
  generateCoachAnalysis,
  type CoachInsightCategory,
  type CoachInsightType,
} from "@/lib/trade-coach-engine"
import { PerformanceHeatmap } from "@/components/dashboard/performance-heatmap"
import { PatternMemoryCard } from "@/components/dashboard/pattern-memory-card"

const TradeQualityAnalyticsPanel = dynamic(
  () =>
    import("@/components/dashboard/trade-quality-analytics-panel").then(
      (module) => module.TradeQualityAnalyticsPanel,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[96px] items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <span className="text-[11px] text-muted-foreground/70">Loading quality analytics…</span>
      </div>
    ),
  },
)
import { AnimatedMetric } from "@/components/dashboard/animated-metric"
import { parseMistakeTags } from "@/lib/trade-form-config"
import { getTradeDisplayMistakeTags } from "@/lib/mistake-tags"
import { MistakeTagList } from "@/components/dashboard/mistake-tag-badge"
import { formatRiskReward, getTradeRiskReward } from "@/lib/trade-form-utils"
import { JOURNAL_MOBILE_BADGE_STACK_CLASS } from "@/lib/journal-badges"
import { cn } from "@/lib/utils"
import { getDashboardTabHref } from "@/lib/dashboard-nav"
import { useResearchLabEnabled } from "@/hooks/use-research-lab-enabled"
import { SignalAlertsBell } from "@/components/tradingview/signal-alerts-bell"
import { resolveStoredSetupScore } from "@/lib/trade-coach/setup-score-engine"
import { SetupScoreBadge } from "@/components/dashboard/setup-score-badge"
import { buildMistakeAnalysis } from "@/lib/mistake-analysis"
import {
  buildDailyRules,
  buildRiskSnapshot,
  DEFAULT_USER_SETTINGS,
  getTradeTimestamp,
  getTradeWeekday,
  type SettingsTrade,
  type UserSettingsForm,
} from "@/lib/user-settings"
import {
  DEFAULT_JOURNAL_FILTERS,
  filterAndSortTrades,
  getJournalFilterOptions,
  type JournalFilters,
  type JournalSortDir,
  type JournalSortKey,
} from "@/lib/journal-utils"
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
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
  risk_reward?: number | null
  trade_notes?: string | null
  mistake_tags?: string | null
  emotion_after?: string | null
  setup_score?: number | null
  setup_classification?: string | null
  setup_score_breakdown?: import("@/lib/trade-coach/setup-score-engine").SetupScoreBreakdown | null
  setup_coaching_insights?: import("@/lib/trade-coach/setup-score-engine").SetupCoachingInsight[] | null
  import_source?: string | null
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

export type DashboardTab = "dashboard" | "strategies" | "analytics" | "journal"

// Daily rules are built dynamically from account settings + today's trades

type DashboardHeaderProps = {
  activeTab: DashboardTab
  onOpenSettings?: () => void
  showSignalBell?: boolean
  onSignalAlertClick?: (signal: import("@/lib/tradingview/types").TradingViewSignalListItem) => void
}

export function DashboardHeader({ activeTab, onOpenSettings, showSignalBell, onSignalAlertClick }: DashboardHeaderProps) {
  const pathname = usePathname()
  const { enabled: researchLabEnabled } = useResearchLabEnabled()
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

  const navItems: { id: DashboardTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "strategies", label: "Strategies", icon: Target },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "journal", label: "Journal", icon: BookOpen },
  ]

  const researchLabActive = pathname.startsWith("/research-lab")
  
  return (
    <header className="dashboard-header">
      <div className="dashboard-container px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative flex size-9 items-center justify-center rounded-[10px] border border-cyan-glow/20 bg-gradient-to-br from-cyan-glow/15 to-profit/10 glow-cyan">
              <Zap className="size-[18px] text-cyan-glow" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-[15px] font-semibold leading-none tracking-tight">Vyronis AI</h1>
              <p className="mt-1 text-[11px] text-muted-foreground/70">Trading Intelligence</p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-0.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-1">
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={getDashboardTabHref(item.id)}
                className={`dashboard-nav-pill ${
                  activeTab === item.id
                    ? "dashboard-nav-pill-active text-cyan-glow"
                    : "dashboard-nav-pill-inactive"
                }`}
              >
                <item.icon className="size-3.5" />
                <span>{item.label}</span>
              </Link>
            ))}
            {researchLabEnabled ? (
              <Link
                href="/research-lab"
                className={`dashboard-nav-pill ${
                  researchLabActive
                    ? "dashboard-nav-pill-active text-cyan-glow"
                    : "dashboard-nav-pill-inactive"
                }`}
              >
                <FlaskConical className="size-3.5" />
                <span>Research Lab</span>
              </Link>
            ) : null}
          </nav>

          <div className="flex items-center gap-2 md:gap-2.5">
            <div className="hidden md:flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {session.isActive ? (
                  <div className={`size-1.5 rounded-full live-pulse live-dot ${session.textClass.replace("text-", "bg-")}`} />
                ) : (
                  <div className="size-1.5 rounded-full bg-loss/80" />
                )}
                <span className={session.isActive ? "live-text-glow text-cyan-glow/90" : ""}>
                  {session.isActive ? "LIVE" : "Closed"}
                </span>
              </div>
              <Badge variant="outline" className={`h-7 text-[11px] font-medium ${session.borderClass} ${session.textClass} ${session.bgClass} ${session.glowClass}`}>
                <Clock className="mr-1 size-3 opacity-70" />
                <span className="hidden xl:inline">{session.name}</span>
                <span className="xl:hidden">{session.name.split(" ")[0]}</span>
                {localTime && <span className="ml-1.5 text-muted-foreground/60 hidden xl:inline">· {localTime}</span>}
              </Badge>
            </div>

            <button
              type="button"
              onClick={() => onOpenSettings?.()}
              className="rounded-[10px] border border-transparent p-2 transition-all duration-200 hover:border-cyan-glow/20 hover:bg-cyan-glow/[0.06] group"
              title="Account Settings"
            >
              <Settings className="size-4 text-muted-foreground transition-colors group-hover:text-cyan-glow" />
            </button>

            {showSignalBell && onSignalAlertClick ? (
              <SignalAlertsBell enabled onSelectSignal={onSignalAlertClick} />
            ) : (
              <button
                type="button"
                className="relative rounded-[10px] border border-transparent p-2 transition-all duration-200 hover:border-white/[0.06] hover:bg-white/[0.04] group"
                title="Setup alerts"
              >
                <Bell className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </button>
            )}

            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.08] px-2.5 py-1">
              <Sparkles className="size-3 text-amber-400" />
              <span className="text-[11px] font-medium tracking-wide text-amber-400">PRO</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.04] lg:hidden">
        <nav className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={getDashboardTabHref(item.id)}
              className={`dashboard-nav-mobile flex flex-col items-center gap-1 rounded-lg px-2 py-1 transition-all duration-200 ${
                activeTab === item.id
                  ? "dashboard-nav-mobile-active text-cyan-glow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="size-[18px]" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          ))}
          {researchLabEnabled ? (
            <Link
              href="/research-lab"
              className={`dashboard-nav-mobile flex flex-col items-center gap-1 rounded-lg px-2 py-1 transition-all duration-200 ${
                researchLabActive
                  ? "dashboard-nav-mobile-active text-cyan-glow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FlaskConical className="size-[18px]" />
              <span className="text-[10px] font-medium">Lab</span>
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  )
}

export function StatsCards({ totalPnL, winRate, tradeCount, avgRisk, startingBalance, accountBalance, maxRiskPerTrade = 1 }: { totalPnL?: number; winRate?: number; tradeCount?: number; avgRisk?: number; startingBalance?: number; accountBalance?: number; maxRiskPerTrade?: number }) {
  const baseBalance = startingBalance || 10000
  const currentBalance = accountBalance !== undefined ? accountBalance : baseBalance
  const roiPercent = totalPnL !== undefined && baseBalance > 0 ? (totalPnL / baseBalance) * 100 : 0
  
  const stats = [
    {
      title: "Account Balance",
      numericValue: currentBalance,
      format: "currency" as const,
      change: `${roiPercent >= 0 ? "+" : ""}${roiPercent.toFixed(1)}%`,
      trend: totalPnL !== undefined ? (totalPnL >= 0 ? "up" : "down") : "up",
      icon: DollarSign,
    },
    {
      title: "Total P&L",
      numericValue: totalPnL ?? 0,
      format: "currency-signed" as const,
      change: tradeCount !== undefined ? `${tradeCount} trades` : "0 trades",
      trend: totalPnL !== undefined ? (totalPnL >= 0 ? "up" : "down") : "up",
      icon: TrendingUp,
    },
    {
      title: "Win Rate",
      numericValue: winRate ?? 0,
      format: "percent" as const,
      change: winRate !== undefined ? (winRate >= 50 ? "Profitable" : "Needs work") : "No trades",
      trend: winRate !== undefined ? (winRate >= 50 ? "up" : "down") : "up",
      icon: Target,
    },
    {
      title: "Avg. Risk",
      numericValue: avgRisk ?? 1,
      format: "number" as const,
      decimals: 2,
      suffix: "%",
      change: avgRisk !== undefined ? (avgRisk <= maxRiskPerTrade ? "Within limits" : "Risk too high") : "No trades",
      trend: avgRisk !== undefined ? (avgRisk <= maxRiskPerTrade ? "up" : "down") : "up",
      icon: BarChart3,
    },
  ]

  return (
    <div className="dashboard-stagger grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      {stats.map((stat, index) => (
        <DashboardCard key={index} interactive glow className="glass-card floating-glow">
          <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-cyan-glow/[0.04] blur-2xl" />
          <DashboardCardBody className="relative pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DashboardMetricLabel>{stat.title}</DashboardMetricLabel>
                <p className="dashboard-metric-value">
                  <AnimatedMetric
                    value={stat.numericValue}
                    format={stat.format}
                    decimals={"decimals" in stat ? stat.decimals : stat.format === "currency" ? 0 : 0}
                  />
                  {"suffix" in stat && stat.suffix ? stat.suffix : ""}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  {stat.trend === "up" ? (
                    <TrendingUp className="size-3 text-profit" />
                  ) : (
                    <TrendingDown className="size-3 text-loss" />
                  )}
                  <span className={`text-[12px] font-medium tabular-nums ${stat.trend === "up" ? "text-profit" : "text-loss"}`}>
                    {stat.change}
                  </span>
                </div>
              </div>
              <DashboardStatIcon icon={stat.icon} />
            </div>
          </DashboardCardBody>
        </DashboardCard>
      ))}
    </div>
  )
}

export function EquityCurveChart({ trades, startingBalance }: { trades?: Trade[]; startingBalance?: number }) {
  const baseBalance = startingBalance || 10000
  const hasTrades = trades && trades.length > 0
  
  const equityData = hasTrades 
    ? (() => {
        const sorted = [...trades].sort(
          (a, b) => getTradeTimestamp(a) - getTradeTimestamp(b),
        )
        const points = [{ date: "Start", equity: baseBalance, pnl: 0 }]
        sorted.forEach((trade, index, arr) => {
          const cumulativePnL = arr.slice(0, index + 1).reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)
          const date = new Date(trade.trade_date || trade.created_at)
          points.push({
            date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            equity: baseBalance + cumulativePnL,
            pnl: getSignedPnL(trade.pnl, trade.result),
          })
        })
        return points
      })()
    : []
  
  const totalPnL = hasTrades ? trades.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0) : 0
  const roiPercent = baseBalance > 0 ? ((totalPnL / baseBalance) * 100).toFixed(1) : "0"
  const chartKey = `${equityData.length}-${totalPnL.toFixed(0)}`
  
  return (
    <DashboardCard className="col-span-2 glass-card floating-glow" inset interactive glow>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-glow/[0.06] to-transparent" />
      <DashboardCardHeader
        title="Equity Curve"
        icon={Activity}
        badge={
          hasTrades ? (
            <Badge variant="outline" className={`h-6 text-[10px] font-medium live-pulse ${totalPnL >= 0 ? "border-profit/25 text-profit bg-profit/[0.08]" : "border-loss/25 text-loss bg-loss/[0.08]"}`}>
              {totalPnL >= 0 ? "+" : ""}{roiPercent}% Total
            </Badge>
          ) : (
            <Badge variant="outline" className="h-6 text-[10px] font-medium text-muted-foreground">No data</Badge>
          )
        }
      />
      <DashboardCardBody className="h-[280px] md:h-[300px]">
        {!hasTrades ? (
          <DashboardEmptyState
            icon={Activity}
            title="No trades to display"
            description="Add trades to see your equity curve"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart key={chartKey} data={equityData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.72 0.14 195)" stopOpacity={0.45} />
                  <stop offset="45%" stopColor="oklch(0.68 0.16 165)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="oklch(0.72 0.14 195)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="equityStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="oklch(0.65 0.12 195)" />
                  <stop offset="100%" stopColor="oklch(0.72 0.14 195)" />
                </linearGradient>
                <filter id="equityGlow">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="date" {...CHART_AXIS} tick={{ fill: "rgba(255,255,255,0.35)" }} />
              <YAxis
                {...CHART_AXIS}
                width={52}
                tick={{ fill: "rgba(255,255,255,0.35)" }}
                tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4, fontSize: 11 }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, "Equity"]}
                cursor={{ stroke: "rgba(34, 211, 238, 0.25)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="url(#equityStroke)"
                strokeWidth={2.5}
                fill="url(#equityGradient)"
                filter="url(#equityGlow)"
                isAnimationActive
                animationDuration={1400}
                animationEasing="ease-out"
                dot={false}
                activeDot={{ r: 5, fill: "oklch(0.72 0.14 195)", stroke: "rgba(255,255,255,0.9)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}

export function WeeklyPerformance({ trades }: { trades?: Trade[] }) {
  const hasTrades = trades && trades.length > 0
  
  // Group trades by weekday
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const weeklyData = hasTrades 
    ? weekdays.map((day, index) => {
        const dayTrades = trades.filter(t => getTradeWeekday(t) === index)
        const pnl = dayTrades.reduce((sum, t) => sum + getSignedPnL(t.pnl, t.result), 0)
        return { day, pnl, trades: dayTrades.length }
      }).filter(d => d.trades > 0) // Only show days with trades
    : []
  
  const hasWeeklyData = weeklyData.length > 0
  
  return (
    <DashboardCard inset interactive glow className="glass-card floating-glow">
      <DashboardCardHeader title="Weekly Performance" icon={Calendar} />
      <DashboardCardBody className="h-[280px] md:h-[300px]">
        {!hasWeeklyData ? (
          <DashboardEmptyState
            icon={Calendar}
            title="No weekly data"
            description="Trade performance will appear here"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart key={weeklyData.length} data={weeklyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={28}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="day" {...CHART_AXIS} tick={{ fill: "rgba(255,255,255,0.35)" }} />
              <YAxis {...CHART_AXIS} width={44} tick={{ fill: "rgba(255,255,255,0.35)" }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4, fontSize: 11 }}
                formatter={(value: number, name: string) => [
                  `$${value.toFixed(2)}`,
                  name === "pnl" ? "P&L" : name
                ]}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar dataKey="pnl" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out">
                {weeklyData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.pnl >= 0 ? "oklch(0.7 0.18 155)" : "oklch(0.55 0.2 25)"}
                    className="transition-opacity hover:opacity-80"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}

export function RecentTradesTable({
  trades,
  onEdit,
  onDelete,
  onScreenshotClick,
  onViewTrade,
  headerActions,
}: {
  trades?: Trade[]
  onEdit?: (trade: Trade) => void
  onDelete?: (trade: Trade) => void
  onScreenshotClick?: (trade: Trade) => void
  onViewTrade?: (trade: Trade) => void
  headerActions?: ReactNode
}) {
  const safeTrades = trades ?? []
  const hasTrades = safeTrades.length > 0

  const readStoredJournalState = <T,>(key: string, fallback: T): T => {
    if (typeof window === "undefined") return fallback
    try {
      const raw = sessionStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  }

  const [filters, setFilters] = useState<JournalFilters>(DEFAULT_JOURNAL_FILTERS)
  const [sortKey, setSortKey] = useState<JournalSortKey>("date")
  const [sortDir, setSortDir] = useState<JournalSortDir>("desc")
  const [journalPrefsHydrated, setJournalPrefsHydrated] = useState(false)

  useEffect(() => {
    setFilters(readStoredJournalState("vyronis-journal-filters", DEFAULT_JOURNAL_FILTERS))
    setSortKey(readStoredJournalState("vyronis-journal-sort-key", "date"))
    setSortDir(readStoredJournalState("vyronis-journal-sort-dir", "desc"))
    setJournalPrefsHydrated(true)
  }, [])

  useEffect(() => {
    if (!journalPrefsHydrated) return
    sessionStorage.setItem("vyronis-journal-filters", JSON.stringify(filters))
  }, [filters, journalPrefsHydrated])

  useEffect(() => {
    if (!journalPrefsHydrated) return
    sessionStorage.setItem("vyronis-journal-sort-key", JSON.stringify(sortKey))
    sessionStorage.setItem("vyronis-journal-sort-dir", JSON.stringify(sortDir))
  }, [sortKey, sortDir, journalPrefsHydrated])

  const filterOptions = useMemo(() => getJournalFilterOptions(safeTrades), [safeTrades])
  const filteredTrades = useMemo(
    () => filterAndSortTrades(safeTrades, filters, sortKey, sortDir),
    [safeTrades, filters, sortKey, sortDir],
  )

  const toggleSort = useCallback((key: JournalSortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        return prev
      }
      setSortDir(key === "date" || key === "pnl" ? "desc" : "asc")
      return key
    })
  }, [])

  const SortHeader = ({ label, column }: { label: string; column: JournalSortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(column)}
      className="group/sort inline-flex items-center gap-1 transition-colors hover:text-cyan-glow"
    >
      {label}
      {sortKey === column ? (
        sortDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
      ) : (
        <ArrowUpDown className="size-3 opacity-0 transition-opacity group-hover/sort:opacity-50" />
      )}
    </button>
  )
  
  return (
    <DashboardCard className="col-span-2 glass-card floating-glow" interactive glow>
      <DashboardCardHeader
        title="Trade Journal"
        icon={BookOpen}
        badge={
          <Badge variant="outline" className="h-6 text-[10px] font-medium">
            {hasTrades ? `${filteredTrades.length} / ${safeTrades.length} trades` : "0 trades"}
          </Badge>
        }
        action={headerActions}
      />
      <DashboardCardBody className="space-y-3 pt-2">
        {hasTrades && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Search trades..."
                className="h-9 border-white/[0.08] bg-white/[0.03] pl-9 text-[13px] focus-visible:border-cyan-glow/40 focus-visible:ring-cyan-glow/15"
              />
            </div>
            <Select value={filters.pair} onValueChange={(v) => setFilters((f) => ({ ...f, pair: v }))}>
              <SelectTrigger className="h-9 border-white/[0.08] bg-white/[0.03] text-[13px]">
                <SelectValue placeholder="Pair" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pairs</SelectItem>
                {filterOptions.pairs.map((pair) => (
                  <SelectItem key={pair} value={pair}>{pair}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.session} onValueChange={(v) => setFilters((f) => ({ ...f, session: v }))}>
              <SelectTrigger className="h-9 border-white/[0.08] bg-white/[0.03] text-[13px]">
                <SelectValue placeholder="Session" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sessions</SelectItem>
                {filterOptions.sessions.map((session) => (
                  <SelectItem key={session} value={session}>{session}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.result} onValueChange={(v) => setFilters((f) => ({ ...f, result: v }))}>
              <SelectTrigger className="h-9 border-white/[0.08] bg-white/[0.03] text-[13px]">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All results</SelectItem>
                {filterOptions.results.map((result) => (
                  <SelectItem key={result} value={result}>{result}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!hasTrades ? (
          <DashboardEmptyState icon={BookOpen} title="No trades logged yet." description="Use New Trade to start your journal" className="min-h-[160px]" />
        ) : filteredTrades.length === 0 ? (
          <DashboardEmptyState icon={Search} title="No trades match your filters." description="Try adjusting search or filter criteria" className="min-h-[160px]" />
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-[13px]">
              <thead>
              <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.08em] text-muted-foreground/70">
                <th className="pb-3 text-left font-medium align-bottom"><SortHeader label="Pair" column="pair" /></th>
                <th className="pb-3 text-left font-medium align-bottom hidden sm:table-cell">Dir</th>
                <th className="pb-3 text-left font-medium align-bottom hidden md:table-cell">Session</th>
                <th className="pb-3 text-left font-medium align-bottom hidden md:table-cell min-w-[7.5rem]">Setup</th>
                <th className="pb-3 text-left font-medium align-bottom hidden md:table-cell min-w-[9rem]">Mistakes</th>
                <th className="pb-3 text-right font-medium hidden lg:table-cell">R:R</th>
                <th className="pb-3 text-right font-medium"><SortHeader label="P&L" column="pnl" /></th>
                <th className="pb-3 text-right font-medium hidden sm:table-cell"><SortHeader label="Result" column="result" /></th>
                <th className="pb-3 text-center font-medium">Chart</th>
                <th className="pb-3 text-right font-medium hidden lg:table-cell"><SortHeader label="Date" column="date" /></th>
                {(onEdit || onDelete || onViewTrade) && <th className="pb-3 text-right font-medium">Actions</th>}
              </tr>
              </thead>
              <tbody>
                {filteredTrades.map((trade) => {
                  const mistakeTags = getTradeDisplayMistakeTags(trade)
                  const tradeRR = getTradeRiskReward(trade)
                  const setupScore = resolveStoredSetupScore(trade)
                  return (
                  <tr key={trade.id} className="dashboard-table-row group">
                    <td className="py-3.5 align-middle">
                      <button
                        type="button"
                        onClick={() => onViewTrade?.(trade)}
                        className="text-left transition-colors hover:text-cyan-glow"
                      >
                        <p className="font-medium tracking-tight leading-tight">{trade.pair}</p>
                        {trade.import_source === "journal_csv" ? (
                          <Badge
                            variant="outline"
                            className="mt-1 h-5 border-cyan-glow/25 bg-cyan-glow/[0.08] text-[9px] text-cyan-glow"
                          >
                            CSV Import
                          </Badge>
                        ) : null}
                      </button>
                      <div className={cn(JOURNAL_MOBILE_BADGE_STACK_CLASS, "md:hidden")}>
                        <div className="shrink-0">
                          <SetupScoreBadge
                            classification={setupScore.classification}
                            score={setupScore.score}
                            showScore
                          />
                        </div>
                        <MistakeTagList
                          tags={mistakeTags}
                          limit={2}
                          compact
                          className="min-w-0 max-w-full"
                        />
                      </div>
                    </td>
                    <td className="py-3.5 align-middle hidden sm:table-cell">
                      <Badge
                        variant="outline"
                        className={`inline-flex h-7 min-h-[28px] items-center px-2.5 text-[11px] font-medium ${
                          trade.direction === "BUY"
                            ? "border-profit/25 text-profit bg-profit/[0.08]"
                            : "border-loss/25 text-loss bg-loss/[0.08]"
                        }`}
                      >
                        {trade.direction}
                      </Badge>
                    </td>
                    <td className="py-3.5 align-middle text-[12px] leading-none text-cyan-glow/90 hidden md:table-cell">
                      {trade.session || "-"}
                    </td>
                    <td className="py-3.5 align-middle hidden md:table-cell">
                      <div className="flex min-h-[28px] items-center">
                        <SetupScoreBadge
                          classification={setupScore.classification}
                          score={setupScore.score}
                          showScore
                        />
                      </div>
                    </td>
                    <td className="py-3.5 align-middle hidden md:table-cell max-w-[240px]">
                      <MistakeTagList tags={mistakeTags} limit={4} className="max-w-[240px]" />
                    </td>
                    <td className="py-3.5 text-right text-[12px] font-medium tabular-nums text-cyan-glow/90 hidden lg:table-cell">
                      {formatRiskReward(tradeRR)}
                    </td>
                    <td className={`py-3.5 text-right font-semibold tabular-nums ${getPnLTextClass(trade.pnl, trade.result)}`}>
                      {formatPnL(trade.pnl, trade.result)}
                    </td>
                    <td className="py-3.5 text-right hidden sm:table-cell">
                      <Badge
                        variant="outline"
                        className={`h-6 text-[10px] font-medium ${
                          trade.result === "WIN"
                            ? "border-profit/25 text-profit bg-profit/[0.08]"
                            : trade.result === "LOSS"
                            ? "border-loss/25 text-loss bg-loss/[0.08]"
                            : "border-white/10 text-muted-foreground bg-white/[0.03]"
                        }`}
                      >
                        {trade.result}
                      </Badge>
                    </td>
                    <td className="py-3.5">
                      <div className="flex justify-center">
                        {trade.screenshot_url ? (
                          <button
                            type="button"
                            onClick={() => trade && onScreenshotClick?.(trade)}
                            className="group/chart journal-screenshot-thumb relative overflow-hidden rounded-lg border border-white/[0.08] transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-glow/40 hover:shadow-[0_0_20px_rgba(34,211,238,0.18)]"
                            title="View chart screenshot"
                          >
                            <img
                              src={trade.screenshot_url}
                              alt={`${trade.pair} chart`}
                              className="dashboard-image-zoom size-10 object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 backdrop-blur-[1px] transition-all duration-300 group-hover/chart:opacity-100">
                              <ImageIcon className="size-4 text-cyan-glow drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                            </div>
                            <div className="pointer-events-none absolute -inset-1 rounded-lg opacity-0 blur-md transition-opacity duration-300 group-hover/chart:opacity-100 bg-cyan-glow/20" />
                          </button>
                        ) : (
                          <span className="text-[12px] text-muted-foreground/35">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 text-right text-[12px] tabular-nums text-muted-foreground hidden lg:table-cell">
                      {new Date(trade.trade_date || trade.created_at).toLocaleDateString()}
                    </td>
                    {(onEdit || onDelete || onViewTrade) && (
                      <td className="py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                          {onViewTrade && (
                            <button
                              onClick={() => onViewTrade(trade)}
                              className="rounded-md border border-transparent p-1.5 transition-all hover:border-cyan-glow/20 hover:bg-cyan-glow/10 group/btn"
                              title="View trade details"
                            >
                              <Eye className="size-3.5 text-muted-foreground transition-colors group-hover/btn:text-cyan-glow" />
                            </button>
                          )}
                          {onEdit && (
                            <button
                              onClick={() => onEdit(trade)}
                              className="rounded-md border border-transparent p-1.5 transition-all hover:border-cyan-glow/20 hover:bg-cyan-glow/10 group/btn"
                              title="Edit trade"
                            >
                              <Pencil className="size-3.5 text-muted-foreground transition-colors group-hover/btn:text-cyan-glow" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(trade)}
                              className="rounded-md border border-transparent p-1.5 transition-all hover:border-loss/20 hover:bg-loss/10 group/btn"
                              title="Delete trade"
                            >
                              <Trash2 className="size-3.5 text-muted-foreground transition-colors group-hover/btn:text-loss" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCardBody>
    </DashboardCard>
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
    <DashboardCard glow interactive className="overflow-hidden">
      <DashboardCardHeader title="AI Psychology Insights" icon={Brain} />
      <DashboardCardBody className="space-y-4">
        {!hasTrades ? (
          <DashboardEmptyState
            icon={Brain}
            title="No data to analyze"
            description="Log trades to unlock AI insights"
            className="min-h-[220px]"
          />
        ) : (
          <>
            <DashboardInsetPanel className="border-cyan-glow/10 bg-cyan-glow/[0.03]">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {analysis?.insight}
              </p>
            </DashboardInsetPanel>
            {[
              { label: "Emotional Stability", value: analysis?.emotionalStability || 0 },
              { label: "FOMO Resistance", value: analysis?.fomoResistance || 0 },
              { label: "Discipline Score", value: analysis?.disciplineScore || 0 },
            ].map((metric) => (
              <div key={metric.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground/80">{metric.label}</span>
                  <span className={`text-[12px] font-semibold tabular-nums ${metric.value >= 70 ? "text-profit" : metric.value >= 50 ? "text-cyan-glow" : "text-loss"}`}>
                    {metric.value}%
                  </span>
                </div>
                <Progress value={metric.value} className="h-1 bg-white/[0.04]" />
              </div>
            ))}
          </>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}

export function DisciplineScore({
  settings,
  trades = [],
  startingBalance = 10000,
}: {
  settings?: UserSettingsForm
  trades?: Trade[]
  startingBalance?: number
}) {
  const resolvedSettings = settings ?? DEFAULT_USER_SETTINGS
  const rules = useMemo(
    () => buildDailyRules(resolvedSettings, trades, startingBalance),
    [resolvedSettings, trades, startingBalance],
  )
  const recentTrades = trades.slice(0, 20)
  const rulesFollowedCount = rules.filter((rule) => rule.checked).length
  const rulesScore = rules.length > 0 ? Math.round((rulesFollowedCount / rules.length) * 100) : 0
  const riskManaged =
    recentTrades.length === 0
      ? 100
      : Math.round(
          (recentTrades.filter(
            (trade) => (trade.risk_percent ?? 0) <= resolvedSettings.max_risk_per_trade,
          ).length /
            recentTrades.length) *
            100,
        )
  const journalScore =
    recentTrades.length === 0
      ? 0
      : Math.round(
          (recentTrades.filter(
            (trade) =>
              Boolean(trade.trade_notes?.trim()) ||
              Boolean(trade.confirmation_signal?.trim()),
          ).length /
            recentTrades.length) *
            100,
        )
  const score = Math.round(rulesScore * 0.45 + riskManaged * 0.35 + journalScore * 0.2)

  return (
    <DashboardCard interactive>
      <DashboardCardHeader title="Discipline Score" icon={Shield} />
      <DashboardCardBody>
        <div className="flex items-center justify-center py-2">
          <div className="relative size-32">
            <svg className="size-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="oklch(0.72 0.14 195)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${score * 2.51} ${100 * 2.51}`}
                className="drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tabular-nums tracking-tight">{score}</span>
              <span className="text-[11px] text-muted-foreground/70">/ 100</span>
            </div>
          </div>
        </div>
        <div className="mt-2 space-y-2.5 text-[12px]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/80">Rules followed</span>
            <span className="font-medium tabular-nums text-profit">
              {rulesFollowedCount}/{rules.length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/80">Risk managed</span>
            <span className={`font-medium tabular-nums ${riskManaged >= 80 ? "text-profit" : "text-amber-400"}`}>
              {riskManaged}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/80">Journal entries</span>
            <span className="font-medium tabular-nums text-amber-400">{journalScore}%</span>
          </div>
        </div>
      </DashboardCardBody>
    </DashboardCard>
  )
}

export function RiskManagement({
  settings,
  trades = [],
  startingBalance = 10000,
}: {
  settings?: UserSettingsForm
  trades?: SettingsTrade[]
  startingBalance?: number
}) {
  const snapshot = useMemo(
    () => buildRiskSnapshot(settings ?? DEFAULT_USER_SETTINGS, trades, startingBalance),
    [settings, trades, startingBalance],
  )

  const dailyLossProgress = snapshot.dailyLossLimit > 0
    ? Math.min(100, (snapshot.todayLossPercent / snapshot.dailyLossLimit) * 100)
    : 0

  return (
    <DashboardCard interactive>
      <DashboardCardHeader title="Risk Management" icon={AlertTriangle} />
      <DashboardCardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <DashboardInsetPanel className="text-center">
            <p className="dashboard-metric-label">Daily Loss Used</p>
            <p className={`mt-1.5 text-lg font-semibold tabular-nums ${snapshot.todayLossPercent >= snapshot.dailyLossLimit ? "text-loss" : "text-foreground"}`}>
              {snapshot.todayLossPercent.toFixed(1)}%
            </p>
          </DashboardInsetPanel>
          <DashboardInsetPanel className="text-center">
            <p className="dashboard-metric-label">Max Risk / Trade</p>
            <p className="mt-1.5 text-lg font-semibold tabular-nums text-cyan-glow">
              {snapshot.maxRiskPerTrade.toFixed(1)}%
            </p>
          </DashboardInsetPanel>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground/80">Daily Loss Limit</span>
            <span className="tabular-nums font-medium">
              {snapshot.todayLossPercent.toFixed(1)}% / {snapshot.dailyLossLimit.toFixed(1)}%
            </span>
          </div>
          <Progress
            value={dailyLossProgress}
            className={`h-1 bg-white/[0.04] ${dailyLossProgress >= 100 ? "[&>div]:bg-loss" : ""}`}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground/80">Avg Risk Per Trade</span>
            <span className={`tabular-nums font-medium ${snapshot.avgRiskPerTrade > snapshot.maxRiskPerTrade ? "text-loss" : "text-profit"}`}>
              {snapshot.avgRiskPerTrade.toFixed(1)}%
            </span>
          </div>
          <Progress
            value={Math.min(100, (snapshot.avgRiskPerTrade / Math.max(snapshot.maxRiskPerTrade, 0.1)) * 100)}
            className="h-1 bg-white/[0.04]"
          />
        </div>
        {snapshot.highRiskTradeCount > 0 && (
          <p className="text-[11px] text-loss/90">
            {snapshot.highRiskTradeCount} trade{snapshot.highRiskTradeCount !== 1 ? "s" : ""} exceeded your max risk setting.
          </p>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}

export function EmotionalStateTracker({ trades = [] }: { trades?: Trade[] }) {
  const emotions = useMemo(() => {
    const recent = trades.slice(0, 15)
    if (recent.length === 0) {
      return [
        { state: "No data", level: 0, color: "bg-secondary" },
      ]
    }

    const counts = new Map<string, number>()
    recent.forEach((trade) => {
      if (!trade.emotion) return
      counts.set(trade.emotion, (counts.get(trade.emotion) ?? 0) + 1)
    })

    const impulsive = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful"])

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([state, count]) => ({
        state,
        level: Math.round((count / recent.length) * 100),
        color: impulsive.has(state) ? "bg-loss" : "bg-profit",
      }))
  }, [trades])

  return (
    <DashboardCard interactive>
      <DashboardCardHeader title="Emotional State" icon={Activity} />
      <DashboardCardBody className="space-y-4">
        {emotions.map((emotion) => (
          <div key={emotion.state} className="space-y-1.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground/80">{emotion.state}</span>
              <span className="tabular-nums font-medium">{emotion.level}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/[0.04]">
              <div
                className={`h-full rounded-full ${emotion.color} transition-all duration-700 ease-out`}
                style={{ width: `${emotion.level}%` }}
              />
            </div>
          </div>
        ))}
      </DashboardCardBody>
    </DashboardCard>
  )
}

export function DailyRulesChecklist({
  settings,
  trades = [],
  startingBalance = 10000,
}: {
  settings?: UserSettingsForm
  trades?: SettingsTrade[]
  startingBalance?: number
}) {
  const rules = useMemo(
    () => buildDailyRules(settings ?? DEFAULT_USER_SETTINGS, trades, startingBalance),
    [settings, trades, startingBalance],
  )

  return (
    <DashboardCard interactive>
      <DashboardCardHeader title="Daily Trading Rules" icon={CheckCircle2} />
      <DashboardCardBody>
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="group flex items-center gap-3 rounded-lg px-1 py-0.5 transition-colors hover:bg-white/[0.02]">
              <Checkbox
                id={`rule-${rule.id}`}
                checked={rule.checked}
                className="border-white/10 data-[state=checked]:border-profit data-[state=checked]:bg-profit"
              />
              <label
                htmlFor={`rule-${rule.id}`}
                className={`text-[13px] leading-snug transition-colors ${rule.checked ? "text-profit/90" : "text-loss/90"}`}
              >
                {rule.rule}
              </label>
            </div>
          ))}
        </div>
      </DashboardCardBody>
    </DashboardCard>
  )
}

export function WinRateAnalytics({ trades }: { trades?: Trade[] }) {
  const safeTrades = trades ?? []
  const winCount = safeTrades.filter((trade) => trade.result === "WIN").length
  const lossCount = safeTrades.filter((trade) => trade.result === "LOSS").length
  const actualTradeCount = safeTrades.length
  const actualWinRate = actualTradeCount > 0 ? Math.round((winCount / actualTradeCount) * 100) : 0

  const chartData = [
    { name: "Wins", value: winCount || (actualTradeCount === 0 ? 1 : 0), color: "var(--profit)" },
    { name: "Losses", value: lossCount || (actualTradeCount === 0 ? 1 : 0), color: "var(--loss)" },
  ]

  const grossProfit = safeTrades.reduce((sum, trade) => {
    const signed = getSignedPnL(trade.pnl, trade.result)
    return signed > 0 ? sum + signed : sum
  }, 0)
  const grossLoss = safeTrades.reduce((sum, trade) => {
    const signed = getSignedPnL(trade.pnl, trade.result)
    return signed < 0 ? sum + Math.abs(signed) : sum
  }, 0)
  const profitFactor =
    grossLoss > 0
      ? (grossProfit / grossLoss).toFixed(2)
      : grossProfit > 0
        ? "∞"
        : "0.00"
  
  return (
  <DashboardCard interactive>
  <DashboardCardHeader title="Win Rate Analytics" icon={Percent} />
  <DashboardCardBody>
  <div className="flex items-center justify-center py-1">
  <div className="relative size-28">
  <ResponsiveContainer width="100%" height="100%">
  <PieChart>
  <Pie
  data={chartData}
  cx="50%"
  cy="50%"
  innerRadius={36}
  outerRadius={50}
  paddingAngle={3}
  dataKey="value"
  stroke="rgba(255,255,255,0.06)"
  strokeWidth={2}
  >
  {chartData.map((entry, index) => (
  <Cell key={`cell-${index}`} fill={entry.color} />
  ))}
  </Pie>
  </PieChart>
  </ResponsiveContainer>
  <div className="absolute inset-0 flex flex-col items-center justify-center">
  <span className="text-xl font-semibold tabular-nums tracking-tight">{actualWinRate}%</span>
  <span className="text-[10px] text-muted-foreground/70">Win Rate</span>
  </div>
  </div>
  </div>
  <div className="mt-4 grid grid-cols-2 gap-3 text-center">
  <DashboardInsetPanel>
  <p className="dashboard-metric-label">Total Trades</p>
  <p className="mt-1 text-lg font-semibold tabular-nums">{actualTradeCount}</p>
  </DashboardInsetPanel>
  <DashboardInsetPanel>
  <p className="dashboard-metric-label">Profit Factor</p>
  <p className="mt-1 text-lg font-semibold tabular-nums text-profit">{profitFactor}</p>
  </DashboardInsetPanel>
  </div>
      </DashboardCardBody>
    </DashboardCard>
  )
}

// Performance heatmap — premium monthly calendar view
export function CalendarHeatmapPlaceholder({ trades }: { trades?: Trade[] }) {
  return <PerformanceHeatmap trades={trades} />
}

export function AITradeCoachPlaceholder({
  trades,
  patternMemoryRefreshKey = 0,
}: {
  trades?: Trade[]
  patternMemoryRefreshKey?: number
}) {
  const analysis = useMemo(() => generateCoachAnalysis(trades ?? []), [trades])
  const mistakeAnalysis = useMemo(() => buildMistakeAnalysis(trades ?? []), [trades])
  const rotationPool = analysis.allInsights.length > 0 ? analysis.allInsights : analysis.insights
  const [activeInsightIndex, setActiveInsightIndex] = useState(0)
  const [isFading, setIsFading] = useState(false)

  useEffect(() => {
    setActiveInsightIndex(0)
  }, [trades?.length])

  useEffect(() => {
    if (rotationPool.length <= 1) return

    let fadeTimeout: ReturnType<typeof setTimeout> | undefined
    const interval = setInterval(() => {
      setIsFading(true)
      fadeTimeout = setTimeout(() => {
        setActiveInsightIndex((prev) => (prev + 1) % rotationPool.length)
        setIsFading(false)
      }, 220)
    }, 4500)

    return () => {
      clearInterval(interval)
      if (fadeTimeout) clearTimeout(fadeTimeout)
    }
  }, [rotationPool.length])

  const activeInsight = rotationPool[activeInsightIndex] ?? analysis.insights[0]

  const typeStyles: Record<CoachInsightType, string> = {
    warning: "border-amber-500/30 bg-amber-500/[0.08] text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.08)]",
    success: "border-profit/30 bg-profit/[0.08] text-profit shadow-[0_0_20px_rgba(34,197,94,0.08)]",
    insight: "border-cyan-glow/30 bg-cyan-glow/[0.08] text-cyan-glow shadow-[0_0_24px_rgba(34,211,238,0.1)]",
    info: "border-white/[0.08] bg-white/[0.03] text-muted-foreground shadow-[0_0_16px_rgba(255,255,255,0.03)]",
    tip: "border-profit/25 bg-profit/[0.06] text-profit/90 shadow-[0_0_16px_rgba(34,197,94,0.06)]",
  }

  const typeIcons: Record<CoachInsightType, typeof Brain> = {
    warning: AlertTriangle,
    success: CheckCircle2,
    insight: Sparkles,
    info: Brain,
    tip: Target,
  }

  const categoryLabels: Record<CoachInsightCategory, string> = {
    winrate: "Win Rate",
    emotion: "Emotion",
    session: "Session",
    setup: "Setup",
    direction: "Direction",
    streak: "Streak",
    fomo: "FOMO",
    discipline: "Discipline",
  }

  return (
    <DashboardCard interactive glow className="glass-card floating-glow overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-glow/[0.05] via-transparent to-profit/[0.04]" />
      <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-cyan-glow/[0.06] blur-3xl" />
      <DashboardCardHeader
        title="AI Trade Coach"
        icon={Brain}
        badge={
          <Badge
            variant="outline"
            className={`h-5 text-[9px] font-semibold tracking-wider ${
              analysis.hasData
                ? "border-cyan-glow/30 bg-cyan-glow/[0.08] text-cyan-glow live-pulse"
                : "border-white/10 bg-white/[0.03] text-muted-foreground"
            }`}
          >
            {analysis.hasData ? "LIVE" : "STANDBY"}
          </Badge>
        }
      />
      <DashboardCardBody className="relative space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <DashboardInsetPanel className="glass border-cyan-glow/10 bg-cyan-glow/[0.03] px-2.5 py-2 text-center">
            <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">Confidence</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-cyan-glow">
              {analysis.confidenceScore}%
            </p>
          </DashboardInsetPanel>
          <DashboardInsetPanel className="glass border-loss/15 bg-loss/[0.04] px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">Top Weakness</p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-loss/90">
              {analysis.topWeakness ?? "Not enough data"}
            </p>
          </DashboardInsetPanel>
          <DashboardInsetPanel className="glass border-profit/15 bg-profit/[0.04] px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">Top Strength</p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-profit/90">
              {analysis.topStrength ?? "Not enough data"}
            </p>
          </DashboardInsetPanel>
        </div>

        {analysis.activeWarnings.length > 0 && (
          <div className="space-y-1.5">
            {analysis.activeWarnings.slice(0, 2).map((warning) => (
              <DashboardInsetPanel
                key={warning.id}
                className="border-amber-500/20 bg-amber-500/[0.06] px-3 py-2"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                  <p className="text-[11px] leading-relaxed text-amber-200/90">{warning.message}</p>
                </div>
              </DashboardInsetPanel>
            ))}
          </div>
        )}

        {mistakeAnalysis.insights[0] && (
          <DashboardInsetPanel className="glass border-loss/20 bg-loss/[0.05] px-3 py-2.5">
            <div className="flex items-start gap-2">
              <Flame className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
              <div>
                <p className="text-[9px] uppercase tracking-[0.12em] text-amber-400/80">Mistake Analysis</p>
                <p className="mt-1 text-[11px] leading-relaxed text-foreground/85">{mistakeAnalysis.insights[0].message}</p>
              </div>
            </div>
          </DashboardInsetPanel>
        )}

        <DashboardInsetPanel className="glass border-cyan-glow/10 bg-cyan-glow/[0.03] px-3 py-2.5">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-cyan-glow" />
            <p className="text-[11px] leading-relaxed text-muted-foreground/85">{analysis.summary}</p>
          </div>
        </DashboardInsetPanel>

        <PatternMemoryCard
          tradeCount={trades?.length ?? 0}
          refreshKey={(trades?.length ?? 0) + patternMemoryRefreshKey}
        />

        <TradeQualityAnalyticsPanel refreshKey={(trades?.length ?? 0) + patternMemoryRefreshKey} />

        {activeInsight && (
          <div
            className={`coach-insight-card rounded-xl border p-3 transition-all duration-300 hover:-translate-y-0.5 ${typeStyles[activeInsight.type]} ${isFading ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}
          >
            {(() => {
              const Icon = typeIcons[activeInsight.type]
              return (
                <div className="flex gap-3">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-black/20">
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-md border border-white/[0.08] bg-black/20 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
                        {categoryLabels[activeInsight.category]}
                      </span>
                      {rotationPool.length > 1 && (
                        <span className="text-[9px] tabular-nums text-muted-foreground/60">
                          {activeInsightIndex + 1}/{rotationPool.length}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] leading-relaxed text-foreground/90">{activeInsight.message}</p>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        <div className="space-y-2">
          {analysis.insights.slice(0, 3).map((insight, index) => {
            if (insight.id === activeInsight?.id) return null
            const Icon = typeIcons[insight.type]
            return (
              <div
                key={insight.id}
                className={`coach-insight-card rounded-xl border p-3 transition-all duration-300 hover:-translate-y-0.5 ${typeStyles[insight.type]}`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="flex gap-3">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-black/20">
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <span className="inline-flex rounded-md border border-white/[0.08] bg-black/20 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
                      {categoryLabels[insight.category]}
                    </span>
                    <p className="text-[12px] leading-relaxed text-foreground/90">{insight.message}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </DashboardCardBody>
    </DashboardCard>
  )
}

export function StreakTrackerPlaceholder({ trades }: { trades?: Trade[] }) {
  const safeTradesArray = trades || []
  
  // Calculate current streak
  const calculateStreak = () => {
    if (safeTradesArray.length === 0) return { count: 0, type: 'neutral' }
    
    const sorted = [...safeTradesArray].sort(
      (a, b) => getTradeTimestamp(b) - getTradeTimestamp(a),
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
  
  // Get last 7 trade results (trades arrive newest-first)
  const lastSeven = safeTradesArray.slice(0, 7).map(t => t.result).reverse()
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
    BREAKEVEN: 'bg-secondary/60 border-border/30',
    PENDING: 'bg-secondary/30 border-border/20',
  }

  return (
    <DashboardCard interactive className="overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/[0.04] via-transparent to-cyan-glow/[0.03]" />
      <DashboardCardHeader title="Streak Tracker" icon={Zap} />
      <DashboardCardBody className="relative">
        <div className="space-y-4">
          {/* Last 7 trades visualization */}
          <div className="flex items-center justify-center gap-1.5">
            {lastSeven.map((result, i) => (
              <div
                key={i}
                className={`flex size-8 items-center justify-center rounded-lg border transition-all duration-200 hover:scale-110 ${resultColors[result]}`}
              >
                {result === 'WIN' && <TrendingUp className="size-4 text-profit" />}
                {result === 'LOSS' && <TrendingDown className="size-4 text-loss" />}
                {(result === 'BE' || result === 'BREAKEVEN') && <div className="size-2 rounded-full bg-muted-foreground" />}
                {result === 'PENDING' && <div className="size-2 rounded-full bg-border" />}
              </div>
            ))}
          </div>
          {/* Current streak display */}
          <div className="space-y-1 text-center">
            <div className={`text-3xl font-semibold tabular-nums tracking-tight ${streakColors[streak.type]}`}>
              {streak.count > 0 ? streak.count : '-'}
            </div>
            <p className="text-[11px] text-muted-foreground/70">
              {streak.count === 0 
                ? 'No active streak' 
                : `${streak.type === 'win' ? 'Win' : 'Loss'} Streak`}
            </p>
          </div>
        </div>
      </DashboardCardBody>
    </DashboardCard>
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
      current.pnl += getSignedPnL(t.pnl, t.result)
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

    const winningTrades = safeTradesArray.filter((trade) => trade.result === "WIN")
    const emotionStats = new Map<string, number>()
    winningTrades.forEach((trade) => {
      if (!trade.emotion) return
      emotionStats.set(trade.emotion, (emotionStats.get(trade.emotion) ?? 0) + 1)
    })
    let topEmotionCount = 0
    emotionStats.forEach((count, emotion) => {
      if (count > topEmotionCount) {
        topEmotionCount = count
        patterns.winningEmotion = emotion
      }
    })

    const strategyStats = new Map<string, { wins: number; total: number }>()
    safeTradesArray.forEach((trade) => {
      const strategy = trade.strategy_name?.trim() || "Unknown"
      const current = strategyStats.get(strategy) || { wins: 0, total: 0 }
      current.total++
      if (trade.result === "WIN") current.wins++
      strategyStats.set(strategy, current)
    })
    let topStrategyRate = 0
    strategyStats.forEach((stats, strategy) => {
      const rate = stats.total > 0 ? stats.wins / stats.total : 0
      if (rate > topStrategyRate && stats.total >= 2) {
        topStrategyRate = rate
        patterns.topStrategy = strategy
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
    <DashboardCard interactive className="overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-500/[0.04] via-transparent to-cyan-glow/[0.03]" />
      <DashboardCardHeader title="Pattern Recognition" icon={Activity} />
      <DashboardCardBody className="relative">
        <div className="grid grid-cols-2 gap-2">
          {patternItems.map((item, i) => (
            <div key={i} className="dashboard-inset-panel transition-all duration-200 hover:border-white/[0.1]">
              <p className="dashboard-metric-label">{item.label}</p>
              <p className={`mt-1 truncate text-[13px] font-medium ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </DashboardCardBody>
    </DashboardCard>
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
        pnl: existing.pnl + getSignedPnL(trade.pnl, trade.result),
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
    <DashboardCard interactive>
      <DashboardCardHeader title="Session Analytics" icon={Clock} />
      <DashboardCardBody>
        {!hasTrades || !sessionAnalytics ? (
          <DashboardEmptyState icon={Clock} title="No session data yet" className="min-h-[120px]" />
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-profit/20 bg-gradient-to-r from-profit/[0.08] to-cyan-glow/[0.06] p-3.5">
              <p className="dashboard-metric-label">Best Session</p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-profit">{sessionAnalytics.bestSession.name}</p>
              <div className="mt-1.5 flex items-center gap-3 text-[12px]">
                <span className={`font-medium tabular-nums ${sessionAnalytics.bestSession.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                  {sessionAnalytics.bestSession.pnl >= 0 ? "+" : ""}${sessionAnalytics.bestSession.pnl.toFixed(0)}
                </span>
                <span className="text-muted-foreground/70">{sessionAnalytics.bestSession.winRate}% WR</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="dashboard-metric-label">Win Rate by Session</p>
              {sessionAnalytics.sessionList.slice(0, 4).map((session) => (
                <div key={session.name} className="flex items-center justify-between rounded-lg px-1 py-0.5 text-[12px] transition-colors hover:bg-white/[0.02]">
                  <span className="text-muted-foreground/80">{session.name}</span>
                  <div className="flex items-center gap-2.5">
                    <span className={`tabular-nums font-medium ${session.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                      {session.pnl >= 0 ? "+" : ""}${session.pnl.toFixed(0)}
                    </span>
                    <span className={`min-w-[2.5rem] text-right font-semibold tabular-nums ${session.winRate >= 50 ? "text-profit" : "text-loss"}`}>
                      {session.winRate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DashboardCardBody>
    </DashboardCard>
  )
}
