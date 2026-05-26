"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Plus, X, TrendingUp, TrendingDown, Sparkles, Zap, AlertTriangle, ShieldCheck, ShieldAlert, LogOut, User, Settings, Save, Pencil, Trash2, Calendar, Upload, Image as ImageIcon, Bell, BarChart2, BookOpen, Lightbulb, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DashboardHeader,
  StatsCards,
  EquityCurveChart,
  WeeklyPerformance,
  RecentTradesTable,
  AIPsychologyInsights,
  DisciplineScore,
  RiskManagement,
  EmotionalStateTracker,
  DailyRulesChecklist,
  WinRateAnalytics,
  SessionStats,
  CalendarHeatmapPlaceholder,
  AITradeCoachPlaceholder,
  StreakTrackerPlaceholder,
  QuantumAnalyticsPlaceholder,
} from "@/components/dashboard/trading-components"

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

type TradeForm = {
  pair: string
  direction: string
  result: string
  pnl: string
  emotion: string
  setup: string
  strategy_name: string
  risk_percent: string
  rule_followed: boolean
  trade_date: string
  higher_timeframe: string
  entry_timeframe: string
  confirmation_timeframe: string
  confirmation_signal: string
  session: string
  screenshot_url: string
}

const initialFormState: TradeForm = {
  pair: "",
  direction: "",
  result: "",
  pnl: "",
  emotion: "",
  setup: "",
  strategy_name: "",
  risk_percent: "1",
  rule_followed: true,
  trade_date: new Date().toISOString().split("T")[0],
  higher_timeframe: "",
  entry_timeframe: "",
  confirmation_timeframe: "",
  confirmation_signal: "",
  session: "",
  screenshot_url: "",
}

const pairs = [
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "USDCAD", "AUDUSD", "NZDUSD",
  "EURGBP", "EURJPY", "EURCHF", "EURCAD", "EURAUD", "EURNZD",
  "GBPJPY", "GBPCHF", "GBPCAD", "GBPAUD", "GBPNZD",
  "AUDJPY", "AUDCHF", "AUDCAD", "AUDNZD",
  "NZDJPY", "NZDCHF", "NZDCAD",
  "CADJPY", "CADCHF", "CHFJPY",
  "XAUUSD", "XAGUSD", "NAS100", "US30", "SPX500"
]
const directions = ["BUY", "SELL"]
const results = ["WIN", "LOSS", "BREAKEVEN"]
const emotions = ["Calm", "Confident", "Anxious", "FOMO", "Revenge", "Euphoric", "Fearful", "Disciplined"]
const setups = ["A+ Setup", "B Setup", "C Setup", "Order Block", "Fair Value Gap", "Liquidity Sweep", "Break of Structure", "Continuation"]
const strategies = ["ICT Concepts", "SMC Strategy", "Supply & Demand", "Price Action", "Scalping", "Swing Trading", "Breakout Strategy", "Mean Reversion"]
const tradingSessions = ["Asia", "London", "New York", "London + New York Overlap", "Pre-Market", "NY AM", "NY PM"]
const timeframes = ["1M", "1W", "1D", "4H", "1H", "30M", "15M", "5M", "1m"]
const confirmationSignals = [
  // Reversal patterns
  "Head and Shoulders", "Inverse Head and Shoulders", "Double Top", "Double Bottom",
  "Triple Top", "Triple Bottom", "Bullish Engulfing", "Bearish Engulfing",
  "Morning Star", "Evening Star", "Pin Bar", "Hammer", "Shooting Star",
  "Doji Reversal", "Liquidity Sweep", "Break of Structure", "Change of Character",
  "Order Block Reaction", "Fair Value Gap Reaction", "Support Rejection", "Resistance Rejection",
  // Continuation patterns
  "Bull Flag", "Bear Flag", "Ascending Triangle", "Descending Triangle",
  "Symmetrical Triangle", "Pennant", "Wedge Breakout", "Channel Breakout",
  "Trendline Retest", "EMA Retest", "Pullback Continuation", "Break and Retest",
  "Inside Bar Breakout", "Range Breakout"
]

type Violation = {
  type: "risk" | "rules" | "emotional"
  message: string
}

type UserSettings = {
  id?: string
  user_id: string
  starting_balance: number
  daily_drawdown_limit: number
  max_risk_per_trade: number
  prop_firm_size: string
  profit_target: number
  preferred_session: string
}

const defaultSettings: Omit<UserSettings, "user_id"> = {
  starting_balance: 10000,
  daily_drawdown_limit: 5,
  max_risk_per_trade: 1,
  prop_firm_size: "10K",
  profit_target: 10,
  preferred_session: "NY Session",
}

const propFirmSizes = ["5K", "10K", "25K", "50K", "100K", "150K", "200K"]
const sessions = ["NY Session", "London Session", "Asian Session", "Sydney Session"]

function getTradeViolations(trade: Trade): Violation[] {
  const violations: Violation[] = []
  
  if (trade.risk_percent && trade.risk_percent > 1) {
    violations.push({ type: "risk", message: "Risk too high" })
  }
  
  if (trade.rule_followed === false) {
    violations.push({ type: "rules", message: "Rules broken" })
  }
  
  if (trade.result === "LOSS" && (trade.emotion === "Revenge" || trade.emotion === "FOMO")) {
    violations.push({ type: "emotional", message: "Emotional risk" })
  }
  
  return violations
}

export default function Home() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [form, setForm] = useState<TradeForm>(initialFormState)
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null)
  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)
  const [settingsForm, setSettingsForm] = useState(defaultSettings)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  
  const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  
  function validateFile(file: File): string | null {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return 'Invalid file type. Allowed: jpg, jpeg, png, webp'
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum size is 10MB'
    }
    return null
  }
  
  async function handleScreenshotUpload(file: File) {
    const validationError = validateFile(file)
    if (validationError) {
      toast({
        title: "Invalid file",
        description: validationError,
        variant: "destructive",
      })
      return
    }
    
    setIsUploading(true)
    setUploadProgress(0)
    
    // Simulate progress for better UX (actual upload doesn't support progress)
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 150)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      
      clearInterval(progressInterval)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }
      
      setUploadProgress(100)
      const { url } = await response.json()
      setForm(prev => ({ ...prev, screenshot_url: url }))
      toast({
        title: "Screenshot uploaded",
        description: "Your chart screenshot has been attached to this trade.",
      })
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload screenshot",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      setTimeout(() => setUploadProgress(0), 500)
    }
  }
  
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }
  
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }
  
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      handleScreenshotUpload(file)
    }
  }
  
  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser({ id: user.id, email: user.email })
        fetchTrades(user.id)
        fetchUserSettings(user.id)
      }
    }
    getUser()
  }, [])

  async function fetchTrades(userId?: string) {
    const uid = userId || user?.id
    if (!uid) return
    
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })

    if (error) {
      console.log(error)
    } else {
      setTrades(data || [])
    }
  }

  async function fetchUserSettings(userId: string) {
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single()

    if (data) {
      setUserSettings(data)
      setSettingsForm({
        starting_balance: data.starting_balance,
        daily_drawdown_limit: data.daily_drawdown_limit,
        max_risk_per_trade: data.max_risk_per_trade,
        prop_firm_size: data.prop_firm_size,
        profit_target: data.profit_target,
        preferred_session: data.preferred_session,
      })
    }
  }

  async function saveUserSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    setIsSavingSettings(true)

    const settingsData = {
      user_id: user.id,
      starting_balance: settingsForm.starting_balance,
      daily_drawdown_limit: settingsForm.daily_drawdown_limit,
      max_risk_per_trade: settingsForm.max_risk_per_trade,
      prop_firm_size: settingsForm.prop_firm_size,
      profit_target: settingsForm.profit_target,
      preferred_session: settingsForm.preferred_session,
      updated_at: new Date().toISOString(),
    }

    let error
    if (userSettings?.id) {
      const result = await supabase
        .from("user_settings")
        .update(settingsData)
        .eq("id", userSettings.id)
      error = result.error
    } else {
      const result = await supabase
        .from("user_settings")
        .insert([settingsData])
      error = result.error
    }

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Settings saved",
        description: "Your account settings have been updated.",
      })
      fetchUserSettings(user.id)
      setIsSettingsOpen(false)
    }

    setIsSavingSettings(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!form.pair || !form.direction || !form.result || !form.pnl) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    if (!user) {
      toast({
        title: "Not authenticated",
        description: "You must be logged in to save trades",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    
    const tradeData = {
      pair: form.pair,
      direction: form.direction,
      result: form.result,
      pnl: parseFloat(form.pnl),
      emotion: form.emotion || "Calm",
      setup: form.setup || "A+ Setup",
      strategy_name: form.strategy_name || null,
      risk_percent: form.risk_percent ? parseFloat(form.risk_percent) : 1,
      rule_followed: form.rule_followed,
      user_id: user.id,
      trade_date: form.trade_date || new Date().toISOString().split("T")[0],
      higher_timeframe: form.higher_timeframe || null,
      entry_timeframe: form.entry_timeframe || null,
      confirmation_timeframe: form.confirmation_timeframe || null,
      confirmation_signal: form.confirmation_signal || null,
      session: form.session || null,
      screenshot_url: form.screenshot_url || null,
    }

    let error
    if (editingTrade) {
      // Update existing trade
      const result = await supabase
        .from("trades")
        .update(tradeData)
        .eq("id", editingTrade.id)
        .eq("user_id", user.id) // Security: only update own trades
      error = result.error
    } else {
      // Insert new trade
      const result = await supabase.from("trades").insert([tradeData])
      error = result.error
    }

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } else {
      toast({
        title: editingTrade ? "Trade updated" : "Trade saved",
        description: `${form.pair} ${form.direction} ${form.result} has been ${editingTrade ? "updated" : "saved"}.`,
      })
      setForm(initialFormState)
      setEditingTrade(null)
      setIsModalOpen(false)
      fetchTrades(user.id)
    }
    setIsSubmitting(false)
  }

  function handleEditTrade(trade: Trade) {
    setEditingTrade(trade)
    setForm({
      pair: trade.pair,
      direction: trade.direction,
      result: trade.result,
      pnl: trade.pnl.toString(),
      emotion: trade.emotion,
      setup: trade.setup,
      strategy_name: trade.strategy_name || "",
      risk_percent: (trade.risk_percent || 1).toString(),
      rule_followed: trade.rule_followed !== false,
      trade_date: trade.trade_date || new Date().toISOString().split("T")[0],
      higher_timeframe: trade.higher_timeframe || "",
      entry_timeframe: trade.entry_timeframe || "",
      confirmation_timeframe: trade.confirmation_timeframe || "",
      confirmation_signal: trade.confirmation_signal || "",
      session: trade.session || "",
      screenshot_url: trade.screenshot_url || "",
    })
    setIsModalOpen(true)
  }

  function handleDeleteClick(trade: Trade) {
    setTradeToDelete(trade)
    setIsDeleteModalOpen(true)
  }

  async function confirmDeleteTrade() {
    if (!tradeToDelete || !user) return

    setIsDeleting(true)
    
    const { error } = await supabase
      .from("trades")
      .delete()
      .eq("id", tradeToDelete.id)
      .eq("user_id", user.id) // Security: only delete own trades

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Trade deleted",
        description: `${tradeToDelete.pair} trade has been removed.`,
      })
      fetchTrades(user.id)
    }

    setIsDeleting(false)
    setIsDeleteModalOpen(false)
    setTradeToDelete(null)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingTrade(null)
    setForm(initialFormState)
  }

  // Calculate live analytics from trades
  const startingBalance = userSettings?.starting_balance || defaultSettings.starting_balance
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0)
  const accountBalance = startingBalance + totalPnL
  const winCount = trades.filter(t => t.result === "WIN").length
  const winRate = trades.length > 0 ? Math.round((winCount / trades.length) * 100) : 0
  const avgRisk = trades.length > 0 ? trades.reduce((sum, t) => sum + (t.risk_percent || 1), 0) / trades.length : 1
  const todayTrades = trades.filter(t => {
    const tradeDate = new Date(t.created_at).toDateString()
    return tradeDate === new Date().toDateString()
  })

  // Calculate violation stats
  const tradesWithViolations = trades.map(t => ({
    ...t,
    violations: getTradeViolations(t)
  }))
  const violationCount = tradesWithViolations.filter(t => t.violations.length > 0).length
  const cleanCount = trades.length - violationCount

  async function handleLogout() {
    setIsLoggingOut(true)
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background chart-grid">
      <DashboardHeader />
      
      {/* User Info Bar */}
      {user && (
        <div className="px-6 pt-4">
          <div className="glass-card rounded-xl border border-border/50 p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-glow/10 border border-cyan-glow/20">
                <User className="size-4 text-cyan-glow" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{user.email}</p>
                <p className="text-xs text-muted-foreground">Logged in as trader</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-lg hover:bg-secondary/50 border border-transparent hover:border-border/50 transition-all group"
                title="Account Settings"
              >
                <Settings className="size-4 text-muted-foreground group-hover:text-cyan-glow transition-colors" />
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="p-2 rounded-lg hover:bg-loss/10 border border-transparent hover:border-loss/30 transition-all group"
                title="Logout"
              >
                {isLoggingOut ? (
                  <div className="size-4 border-2 border-loss/30 border-t-loss rounded-full animate-spin" />
                ) : (
                  <LogOut className="size-4 text-muted-foreground group-hover:text-loss transition-colors" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Dashboard Content */}
      <main className="p-4 md:p-6 space-y-4 md:space-y-6 pb-24">
        {/* Stats Cards */}
        <StatsCards 
          accountBalance={accountBalance} 
          totalPnL={totalPnL} 
          winRate={winRate} 
          avgRisk={avgRisk}
          todayTrades={todayTrades.length}
          tradeCount={trades.length}
        />
        
        {/* Main Charts Row */}
        <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-3">
          <EquityCurveChart trades={trades} startingBalance={startingBalance} />
          <WeeklyPerformance trades={trades} />
        </div>
        
        {/* Trades Table and AI Insights */}
        <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-3">
          <RecentTradesTable trades={trades} onEdit={handleEditTrade} onDelete={handleDeleteClick} onImageClick={setFullscreenImage} />
          <AIPsychologyInsights trades={trades} />
        </div>

        {/* AI Modules Row - Premium Placeholders */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6 lg:grid-cols-4">
          <CalendarHeatmapPlaceholder trades={trades} />
          <AITradeCoachPlaceholder trades={trades} />
          <StreakTrackerPlaceholder trades={trades} />
          <QuantumAnalyticsPlaceholder trades={trades} />
        </div>
        
        {/* Bottom Row - Analytics Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6 lg:grid-cols-4">
          <DisciplineScore />
          <RiskManagement />
          <EmotionalStateTracker />
          <WinRateAnalytics winRate={winRate} tradeCount={trades.length} totalPnL={totalPnL} />
        </div>
        
        {/* Rules and Session */}
        <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-2">
          <DailyRulesChecklist />
          <SessionStats trades={trades} />
        </div>
      </main>

      {/* Floating New Trade Button */}
      <button
        onClick={() => {
          setEditingTrade(null)
          setForm(initialFormState)
          setIsModalOpen(true)
        }}
        className="group fixed bottom-6 right-6 z-40 flex items-center justify-center gap-2 px-4 py-3 md:px-5 md:py-3 rounded-full bg-gradient-to-r from-cyan-glow/90 to-profit/90 text-background font-semibold shadow-lg shadow-cyan-glow/20 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-glow/30 hover:-translate-y-0.5 hover:from-cyan-glow hover:to-profit"
      >
        <Plus className="size-5" />
        <span className="hidden md:inline">New Trade</span>
      </button>

      {/* Premium Cyberpunk Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
            onClick={closeModal}
          />
          
          {/* Modal */}
          <div className="relative w-full max-w-lg animated-border rounded-2xl max-h-[85vh] overflow-hidden">
            <div className="glass-card rounded-2xl border border-cyan-glow/20 overflow-hidden">
              {/* Header */}
              <div className="relative px-4 md:px-6 py-4 md:py-5 border-b border-border/50">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-glow/10 via-transparent to-profit/10" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-glow/20">
                      {editingTrade ? <Pencil className="size-5 text-cyan-glow" /> : <Plus className="size-5 text-cyan-glow" />}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">{editingTrade ? "Edit Trade" : "New Trade"}</h2>
                      <p className="text-xs text-muted-foreground">{editingTrade ? "Update your trade details" : "Log your trade details"}</p>
                    </div>
                  </div>
                  <button 
                    onClick={closeModal}
                    className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <X className="size-5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 max-h-[calc(85vh-100px)] overflow-y-auto">
                {/* Pair & Direction Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Trading Pair <span className="text-loss">*</span></Label>
                    <Select value={form.pair} onValueChange={(v) => setForm({...form, pair: v})}>
                      <SelectTrigger className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20">
                        <SelectValue placeholder="Select pair" />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-border/50 max-h-60">
                        {pairs.map(p => (
                          <SelectItem key={p} value={p} className="focus:bg-cyan-glow/10 focus:text-foreground">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Direction <span className="text-loss">*</span></Label>
                    <Select value={form.direction} onValueChange={(v) => setForm({...form, direction: v})}>
                      <SelectTrigger className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20">
                        <SelectValue placeholder="Buy/Sell" />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-border/50">
                        {directions.map(d => (
                          <SelectItem key={d} value={d} className={`focus:bg-cyan-glow/10 ${d === "BUY" ? "text-profit" : "text-loss"}`}>
                            <div className="flex items-center gap-2">
                              {d === "BUY" ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                              {d}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Result & P&L Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Result <span className="text-loss">*</span></Label>
                    <Select value={form.result} onValueChange={(v) => setForm({...form, result: v})}>
                      <SelectTrigger className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20">
                        <SelectValue placeholder="Win/Loss" />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-border/50">
                        {results.map(r => (
                          <SelectItem key={r} value={r} className={`focus:bg-cyan-glow/10 ${r === "WIN" ? "text-profit" : r === "LOSS" ? "text-loss" : "text-muted-foreground"}`}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">P&L ($) <span className="text-loss">*</span></Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="+150.00"
                      value={form.pnl}
                      onChange={(e) => setForm({...form, pnl: e.target.value})}
                      className={`bg-secondary/30 border-border/50 focus:ring-cyan-glow/20 placeholder:text-muted-foreground/50 ${
                        parseFloat(form.pnl) >= 0 
                          ? "focus:border-profit/50 text-profit" 
                          : "focus:border-loss/50 text-loss"
                      }`}
                    />
                  </div>
                </div>

                {/* Trade Date & Session Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="size-3" />
                      Trade Date
                    </Label>
                    <Input
                      type="date"
                      value={form.trade_date}
                      onChange={(e) => setForm({...form, trade_date: e.target.value})}
                      className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Trading Session</Label>
                    <Select value={form.session} onValueChange={(v) => setForm({...form, session: v})}>
                      <SelectTrigger className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20">
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-border/50">
                        {tradingSessions.map(s => (
                          <SelectItem key={s} value={s} className="focus:bg-cyan-glow/10 focus:text-foreground">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Timeframe Section Divider */}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-3 text-xs text-cyan-glow uppercase tracking-wider">Timeframe Analysis</span>
                  </div>
                </div>

                {/* Timeframes Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Higher TF Bias</Label>
                    <Select value={form.higher_timeframe} onValueChange={(v) => setForm({...form, higher_timeframe: v})}>
                      <SelectTrigger className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20">
                        <SelectValue placeholder="HTF" />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-border/50">
                        {timeframes.map(tf => (
                          <SelectItem key={tf} value={tf} className="focus:bg-cyan-glow/10 focus:text-foreground">{tf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Entry TF</Label>
                    <Select value={form.entry_timeframe} onValueChange={(v) => setForm({...form, entry_timeframe: v})}>
                      <SelectTrigger className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20">
                        <SelectValue placeholder="Entry" />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-border/50">
                        {timeframes.map(tf => (
                          <SelectItem key={tf} value={tf} className="focus:bg-cyan-glow/10 focus:text-foreground">{tf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Confirm TF</Label>
                    <Select value={form.confirmation_timeframe} onValueChange={(v) => setForm({...form, confirmation_timeframe: v})}>
                      <SelectTrigger className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20">
                        <SelectValue placeholder="Confirm" />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-border/50">
                        {timeframes.map(tf => (
                          <SelectItem key={tf} value={tf} className="focus:bg-cyan-glow/10 focus:text-foreground">{tf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Confirmation Signal */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Confirmation Signal</Label>
                  <Select value={form.confirmation_signal} onValueChange={(v) => setForm({...form, confirmation_signal: v})}>
                    <SelectTrigger className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20">
                      <SelectValue placeholder="Select signal pattern" />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-border/50 max-h-60">
                      <div className="px-2 py-1.5 text-xs font-semibold text-cyan-glow uppercase tracking-wider">Reversal Patterns</div>
                      {confirmationSignals.slice(0, 21).map(s => (
                        <SelectItem key={s} value={s} className="focus:bg-cyan-glow/10 focus:text-foreground">{s}</SelectItem>
                      ))}
                      <div className="px-2 py-1.5 text-xs font-semibold text-cyan-glow uppercase tracking-wider border-t border-border/30 mt-1">Continuation Patterns</div>
                      {confirmationSignals.slice(21).map(s => (
                        <SelectItem key={s} value={s} className="focus:bg-cyan-glow/10 focus:text-foreground">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Emotion & Setup Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Emotional State</Label>
                    <Select value={form.emotion} onValueChange={(v) => setForm({...form, emotion: v})}>
                      <SelectTrigger className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20">
                        <SelectValue placeholder="How did you feel?" />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-border/50">
                        {emotions.map(e => (
                          <SelectItem key={e} value={e} className="focus:bg-cyan-glow/10 focus:text-foreground">{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Setup Quality</Label>
                    <Select value={form.setup} onValueChange={(v) => setForm({...form, setup: v})}>
                      <SelectTrigger className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20">
                        <SelectValue placeholder="Rate setup" />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-border/50">
                        {setups.map(s => (
                          <SelectItem key={s} value={s} className="focus:bg-cyan-glow/10 focus:text-foreground">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Strategy Name */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Strategy Name</Label>
                  <Select value={form.strategy_name} onValueChange={(v) => setForm({...form, strategy_name: v})}>
                    <SelectTrigger className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20">
                      <SelectValue placeholder="Select strategy" />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-border/50">
                      {strategies.map(s => (
                        <SelectItem key={s} value={s} className="focus:bg-cyan-glow/10 focus:text-foreground">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Risk Percent & Rule Followed Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Risk % <span className={parseFloat(form.risk_percent) > 1 ? "text-loss" : "text-profit"}>({form.risk_percent || 1}%)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      placeholder="1"
                      value={form.risk_percent}
                      onChange={(e) => setForm({...form, risk_percent: e.target.value})}
                      className={`bg-secondary/30 border-border/50 focus:ring-cyan-glow/20 placeholder:text-muted-foreground/50 ${
                        parseFloat(form.risk_percent) > 1 
                          ? "border-loss/50 focus:border-loss/70" 
                          : "focus:border-cyan-glow/50"
                      }`}
                    />
                    {parseFloat(form.risk_percent) > 1 && (
                      <p className="text-xs text-loss flex items-center gap-1">
                        <AlertTriangle className="size-3" />
                        Risk above 1% - violation detected
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Rules Followed</Label>
                    <div className={`flex items-center justify-between p-3 rounded-lg border ${
                      form.rule_followed 
                        ? "bg-profit/5 border-profit/30" 
                        : "bg-loss/5 border-loss/30"
                    }`}>
                      <div className="flex items-center gap-2">
                        {form.rule_followed ? (
                          <ShieldCheck className="size-4 text-profit" />
                        ) : (
                          <ShieldAlert className="size-4 text-loss" />
                        )}
                        <span className={`text-sm font-medium ${form.rule_followed ? "text-profit" : "text-loss"}`}>
                          {form.rule_followed ? "Yes" : "No"}
                        </span>
                      </div>
                      <Switch
                        checked={form.rule_followed}
                        onCheckedChange={(checked) => setForm({...form, rule_followed: checked})}
                        className="data-[state=checked]:bg-profit data-[state=unchecked]:bg-loss"
                      />
                    </div>
                    {!form.rule_followed && (
                      <p className="text-xs text-loss flex items-center gap-1">
                        <AlertTriangle className="size-3" />
                        Rule violation will be flagged
                      </p>
                    )}
                  </div>
                </div>

                {/* Screenshot Upload */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="size-3" />
                    Chart Screenshot
                  </Label>
                  {form.screenshot_url ? (
                    <div className="relative rounded-lg border border-border/50 overflow-hidden bg-secondary/20 group">
                      <img 
                        src={form.screenshot_url} 
                        alt="Trade chart" 
                        className="w-full h-32 object-cover cursor-pointer transition-transform hover:scale-105"
                        onClick={() => setFullscreenImage(form.screenshot_url)}
                      />
                      <button
                        type="button"
                        onClick={() => setForm({...form, screenshot_url: ""})}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/80 border border-border/50 hover:bg-loss/20 hover:border-loss/50 transition-all"
                      >
                        <X className="size-4 text-muted-foreground hover:text-loss" />
                      </button>
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-background/80 border border-profit/30">
                        <span className="text-xs text-profit flex items-center gap-1">
                          <Sparkles className="size-3" />
                          Screenshot attached
                        </span>
                      </div>
                      <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-xs text-foreground bg-background/80 px-2 py-1 rounded">Click to enlarge</span>
                      </div>
                    </div>
                  ) : (
                    <label 
                      className={`flex flex-col items-center justify-center h-28 rounded-lg border-2 border-dashed bg-secondary/10 cursor-pointer transition-all ${
                        isDragging 
                          ? 'border-cyan-glow bg-cyan-glow/10 scale-[1.02]' 
                          : 'border-border/50 hover:bg-secondary/20 hover:border-cyan-glow/30'
                      } group`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleScreenshotUpload(file)
                        }}
                        disabled={isUploading}
                      />
                      {isUploading ? (
                        <div className="flex flex-col items-center gap-3 w-full px-6">
                          <div className="relative size-8">
                            <div className="absolute inset-0 border-2 border-cyan-glow/30 rounded-full" />
                            <div className="absolute inset-0 border-2 border-transparent border-t-cyan-glow rounded-full animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-cyan-glow">{uploadProgress}%</span>
                            </div>
                          </div>
                          <div className="w-full bg-secondary/30 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-cyan-glow to-profit transition-all duration-300 ease-out"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <span className="text-xs text-cyan-glow">Uploading screenshot...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className={`size-6 transition-colors ${isDragging ? 'text-cyan-glow' : 'text-muted-foreground group-hover:text-cyan-glow'}`} />
                          <div className="text-center">
                            <span className={`text-xs transition-colors ${isDragging ? 'text-cyan-glow' : 'text-muted-foreground group-hover:text-foreground'}`}>
                              {isDragging ? 'Drop image here' : 'Drag & drop or click to upload'}
                            </span>
                            <p className="text-[10px] text-muted-foreground mt-1">JPG, PNG, WebP up to 10MB</p>
                          </div>
                        </div>
                      )}
                    </label>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 bg-gradient-to-r from-cyan-glow to-profit hover:from-cyan-glow/90 hover:to-profit/90 text-background font-bold text-base glow-cyan transition-all duration-300"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="size-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                        {editingTrade ? "Updating Trade..." : "Saving Trade..."}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {editingTrade ? <Pencil className="size-5" /> : <Sparkles className="size-5" />}
                        {editingTrade ? "Update Trade" : "Save Trade"}
                      </div>
                    )}
                  </Button>
                </div>

                {/* Helper Text */}
                <p className="text-xs text-center text-muted-foreground">
                  <span className="text-loss">*</span> Required fields
                </p>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
            onClick={() => setIsSettingsOpen(false)}
          />
          
          {/* Modal */}
          <div className="relative w-full max-w-lg mx-4 animated-border rounded-2xl max-h-[90vh] overflow-hidden">
            <div className="glass-card rounded-2xl border border-cyan-glow/20 overflow-hidden">
              {/* Header */}
              <div className="relative px-6 py-5 border-b border-border/50">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-glow/10 via-transparent to-profit/10" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-glow/20">
                      <Settings className="size-5 text-cyan-glow" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Account Settings</h2>
                      <p className="text-xs text-muted-foreground">Configure your trading parameters</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <X className="size-5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={saveUserSettings} className="p-6 space-y-5 max-h-[calc(90vh-100px)] overflow-y-auto">
                {/* Starting Balance & Prop Firm Size */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Starting Balance ($)
                    </Label>
                    <Input
                      type="number"
                      step="100"
                      min="0"
                      placeholder="10000"
                      value={settingsForm.starting_balance}
                      onChange={(e) => setSettingsForm({...settingsForm, starting_balance: parseFloat(e.target.value) || 0})}
                      className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Prop Firm Size
                    </Label>
                    <Select value={settingsForm.prop_firm_size} onValueChange={(v) => setSettingsForm({...settingsForm, prop_firm_size: v})}>
                      <SelectTrigger className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-border/50">
                        {propFirmSizes.map(s => (
                          <SelectItem key={s} value={s} className="focus:bg-cyan-glow/10 focus:text-foreground">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Risk Management Section */}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-3 text-xs text-cyan-glow uppercase tracking-wider">Risk Management</span>
                  </div>
                </div>

                {/* Daily Drawdown & Max Risk */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Daily Drawdown Limit (%)
                    </Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      placeholder="5"
                      value={settingsForm.daily_drawdown_limit}
                      onChange={(e) => setSettingsForm({...settingsForm, daily_drawdown_limit: parseFloat(e.target.value) || 0})}
                      className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20"
                    />
                    <p className="text-xs text-muted-foreground">Max daily loss before stopping</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Max Risk Per Trade (%)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      placeholder="1"
                      value={settingsForm.max_risk_per_trade}
                      onChange={(e) => setSettingsForm({...settingsForm, max_risk_per_trade: parseFloat(e.target.value) || 0})}
                      className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20"
                    />
                    <p className="text-xs text-muted-foreground">Position size limit</p>
                  </div>
                </div>

                {/* Targets Section */}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-3 text-xs text-cyan-glow uppercase tracking-wider">Targets & Preferences</span>
                  </div>
                </div>

                {/* Profit Target & Preferred Session */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Profit Target (%)
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      placeholder="10"
                      value={settingsForm.profit_target}
                      onChange={(e) => setSettingsForm({...settingsForm, profit_target: parseFloat(e.target.value) || 0})}
                      className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20"
                    />
                    <p className="text-xs text-muted-foreground">Monthly profit goal</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Preferred Session
                    </Label>
                    <Select value={settingsForm.preferred_session} onValueChange={(v) => setSettingsForm({...settingsForm, preferred_session: v})}>
                      <SelectTrigger className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 focus:ring-cyan-glow/20">
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-border/50">
                        {sessions.map(s => (
                          <SelectItem key={s} value={s} className="focus:bg-cyan-glow/10 focus:text-foreground">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Current Settings Preview */}
                <div className="p-4 rounded-lg bg-secondary/20 border border-border/30 space-y-2">
                  <p className="text-xs text-cyan-glow uppercase tracking-wider font-medium">Current Account Status</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Starting:</span>
                      <span className="font-medium">${settingsForm.starting_balance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current:</span>
                      <span className={`font-medium ${accountBalance >= startingBalance ? "text-profit" : "text-loss"}`}>
                        ${accountBalance.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">P&L:</span>
                      <span className={`font-medium ${totalPnL >= 0 ? "text-profit" : "text-loss"}`}>
                        {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ROI:</span>
                      <span className={`font-medium ${totalPnL >= 0 ? "text-profit" : "text-loss"}`}>
                        {((totalPnL / settingsForm.starting_balance) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSavingSettings}
                    className="w-full h-12 bg-gradient-to-r from-cyan-glow to-profit hover:from-cyan-glow/90 hover:to-profit/90 text-background font-bold text-base glow-cyan transition-all duration-300"
                  >
                    {isSavingSettings ? (
                      <div className="flex items-center gap-2">
                        <div className="size-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                        Saving Settings...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Save className="size-5" />
                        Save Settings
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && tradeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
            onClick={() => {
              setIsDeleteModalOpen(false)
              setTradeToDelete(null)
            }}
          />
          
          {/* Modal */}
          <div className="relative w-full max-w-md mx-4 animated-border rounded-2xl">
            <div className="glass-card rounded-2xl border border-loss/20 overflow-hidden">
              {/* Header */}
              <div className="relative px-6 py-5 border-b border-border/50">
                <div className="absolute inset-0 bg-gradient-to-r from-loss/10 via-transparent to-transparent" />
                <div className="relative flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-loss/20">
                    <Trash2 className="size-5 text-loss" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Delete Trade</h2>
                    <p className="text-xs text-muted-foreground">This action cannot be undone</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Are you sure you want to delete this trade?
                </p>
                
                <div className="rounded-lg bg-secondary/30 p-4 border border-border/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">{tradeToDelete.pair}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      tradeToDelete.result === "WIN" 
                        ? "bg-profit/20 text-profit" 
                        : tradeToDelete.result === "LOSS"
                        ? "bg-loss/20 text-loss"
                        : "bg-muted/50 text-muted-foreground"
                    }`}>
                      {tradeToDelete.result}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Direction:</span>
                      <span className={`ml-1 ${tradeToDelete.direction === "BUY" ? "text-profit" : "text-loss"}`}>
                        {tradeToDelete.direction}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">P&L:</span>
                      <span className={`ml-1 font-medium ${tradeToDelete.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                        {tradeToDelete.pnl >= 0 ? "+" : ""}${tradeToDelete.pnl}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDeleteModalOpen(false)
                      setTradeToDelete(null)
                    }}
                    className="flex-1 h-11 border-border/50 hover:bg-secondary/50"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={confirmDeleteTrade}
                    disabled={isDeleting}
                    className="flex-1 h-11 bg-loss hover:bg-loss/90 text-white"
                  >
                    {isDeleting ? (
                      <div className="flex items-center gap-2">
                        <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Deleting...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Trash2 className="size-4" />
                        Delete Trade
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Modal */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-fade"
          onClick={() => setFullscreenImage(null)}
        >
          <div className="absolute inset-0 bg-background/95 backdrop-blur-md" />
          <div className="relative max-w-5xl max-h-[90vh] w-full scale-in">
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute -top-12 right-0 p-2 rounded-lg bg-secondary/50 border border-border/50 hover:bg-loss/20 hover:border-loss/50 transition-all z-10"
            >
              <X className="size-5 text-muted-foreground hover:text-loss" />
            </button>
            <img 
              src={fullscreenImage} 
              alt="Trade chart fullscreen" 
              className="w-full h-full object-contain rounded-lg border border-border/50 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      <Toaster />
    </div>
  )
}
