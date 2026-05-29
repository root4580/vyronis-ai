"use client"

import { useState } from "react"
import {
  Plus,
  Edit3,
  Save,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Brain,
  Clock,
  Target,
  TrendingUp,
  Award,
  Star,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  RotateCcw,
  Tag,
  Zap,
  Activity,
  AlertOctagon,
  BookOpen,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

// Types
interface Strategy {
  id: string
  name: string
  description: string
  setupTypes: string[]
  timeframes: string[]
  entryChecklist: ChecklistItem[]
  psychologyRules: string[]
  invalidationConditions: string[]
  riskManagement: RiskRule[]
  complianceScore: number
  isAPlus: boolean
  tradesUsing: number
  winRate: number
}

interface ChecklistItem {
  id: string
  text: string
  checked: boolean
  required: boolean
}

interface RiskRule {
  id: string
  name: string
  value: string
  enabled: boolean
}

// Mock data
const mockStrategies: Strategy[] = [
  {
    id: "1",
    name: "ICT Silver Bullet",
    description: "High probability reversal setup during NY session kill zones using order blocks and FVGs",
    setupTypes: ["Reversal", "Continuation", "Order Block"],
    timeframes: ["15M", "5M", "1M"],
    entryChecklist: [
      { id: "1", text: "Higher timeframe bias confirmed", checked: false, required: true },
      { id: "2", text: "Kill zone timing (10:00-11:00 AM EST)", checked: false, required: true },
      { id: "3", text: "Order block or FVG identified", checked: false, required: true },
      { id: "4", text: "Liquidity sweep observed", checked: false, required: false },
      { id: "5", text: "Market structure shift on LTF", checked: false, required: true },
    ],
    psychologyRules: [
      "Wait for full confirmation before entry",
      "No FOMO entries outside kill zones",
      "Accept that not every setup will play out",
      "Trust the process, not the outcome",
    ],
    invalidationConditions: [
      "Price breaks above/below the order block",
      "No market structure shift within 30 minutes",
      "Conflicting higher timeframe bias",
      "Major news event during trade",
    ],
    riskManagement: [
      { id: "1", name: "Max Risk per Trade", value: "1%", enabled: true },
      { id: "2", name: "Max Daily Loss", value: "3%", enabled: true },
      { id: "3", name: "Min R:R Ratio", value: "1:2", enabled: true },
      { id: "4", name: "Max Concurrent Trades", value: "2", enabled: true },
    ],
    complianceScore: 94,
    isAPlus: true,
    tradesUsing: 47,
    winRate: 72,
  },
  {
    id: "2",
    name: "London Breakout",
    description: "Momentum continuation setup during London session open with Asian range breakout",
    setupTypes: ["Breakout", "Momentum"],
    timeframes: ["1H", "15M"],
    entryChecklist: [
      { id: "1", text: "Asian range defined (tight consolidation)", checked: false, required: true },
      { id: "2", text: "London open timing (3:00-4:00 AM EST)", checked: false, required: true },
      { id: "3", text: "Volume spike on breakout", checked: false, required: true },
      { id: "4", text: "No major news within 1 hour", checked: false, required: false },
    ],
    psychologyRules: [
      "Only trade clean breakouts with momentum",
      "Avoid fakeouts by waiting for candle close",
      "Accept small losses quickly",
    ],
    invalidationConditions: [
      "Breakout fails to hold above/below Asian high/low",
      "Reversal candle within first 15 minutes",
      "Price returns to mid-range",
    ],
    riskManagement: [
      { id: "1", name: "Max Risk per Trade", value: "0.75%", enabled: true },
      { id: "2", name: "Max Daily Loss", value: "2%", enabled: true },
      { id: "3", name: "Min R:R Ratio", value: "1:1.5", enabled: true },
    ],
    complianceScore: 78,
    isAPlus: false,
    tradesUsing: 23,
    winRate: 65,
  },
]

const setupTypeOptions = [
  "Reversal", "Continuation", "Breakout", "Momentum", "Order Block",
  "FVG", "Liquidity Grab", "Range Play", "Trend Following", "Mean Reversion"
]

const timeframeOptions = ["1M", "5M", "15M", "30M", "1H", "4H", "D", "W"]

// Strategy Header Component
export function StrategyHeader() {
  return (
    <header className="glass-card border-b border-border/50 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative size-10 rounded-lg bg-gradient-to-br from-cyan-glow/20 to-profit/20 flex items-center justify-center glow-cyan">
                <Zap className="size-5 text-cyan-glow" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Vyronis HQ</h1>
                <p className="text-xs text-muted-foreground">Strategy Builder</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="border-border/50 hover:border-cyan-glow/30 hover:bg-cyan-glow/5">
            <a href="/" className="flex items-center gap-2">
              <Activity className="size-4" />
              Dashboard
            </a>
          </Button>
          <Button size="sm" className="bg-cyan-glow/20 text-cyan-glow hover:bg-cyan-glow/30 border border-cyan-glow/30">
            <Plus className="size-4 mr-1" />
            New Strategy
          </Button>
        </div>
      </div>
    </header>
  )
}

// Strategy List Component
export function StrategyList({ 
  strategies, 
  selectedId, 
  onSelect 
}: { 
  strategies: Strategy[]
  selectedId: string | null
  onSelect: (id: string) => void 
}) {
  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BookOpen className="size-4 text-cyan-glow" />
          My Strategies
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {strategies.map((strategy) => (
          <button
            key={strategy.id}
            onClick={() => onSelect(strategy.id)}
            className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
              selectedId === strategy.id
                ? "border-cyan-glow/50 bg-cyan-glow/10"
                : "border-border/30 hover:border-cyan-glow/20 hover:bg-secondary/30"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{strategy.name}</span>
                  {strategy.isAPlus && (
                    <Badge className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 shrink-0">
                      <Award className="size-3 mr-0.5" />
                      A+
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {strategy.description}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-medium text-profit">{strategy.winRate}%</div>
                <div className="text-[10px] text-muted-foreground">{strategy.tradesUsing} trades</div>
              </div>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}

// Strategy Compliance Score Component
export function StrategyComplianceScore({ score, isAPlus }: { score: number; isAPlus: boolean }) {
  const getScoreColor = (s: number) => {
    if (s >= 90) return "text-profit"
    if (s >= 70) return "text-cyan-glow"
    if (s >= 50) return "text-yellow-500"
    return "text-loss"
  }

  const getScoreStroke = (s: number) => {
    if (s >= 90) return "oklch(0.7 0.18 155)"
    if (s >= 70) return "oklch(0.7 0.15 195)"
    if (s >= 50) return "oklch(0.75 0.12 85)"
    return "oklch(0.55 0.2 25)"
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="size-4 text-cyan-glow" />
            Strategy Compliance
          </span>
          {isAPlus && (
            <Badge className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/30 animate-pulse">
              <Award className="size-3 mr-1" />
              A+ Setup
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-4">
          <div className="relative size-36">
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
                stroke={getScoreStroke(score)}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${score * 2.51} ${100 * 2.51}`}
                className="drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold ${getScoreColor(score)}`}>{score}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>
        </div>
        <div className="mt-2 text-center">
          <p className="text-xs text-muted-foreground">
            {score >= 90 ? "Excellent compliance! This is an A+ setup." : 
             score >= 70 ? "Good compliance. Review checklist for A+ status." :
             score >= 50 ? "Moderate compliance. Consider waiting for better setup." :
             "Low compliance. Do not trade this setup."}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// Emotional Discipline Meter
export function EmotionalDisciplineMeter() {
  const [discipline, setDiscipline] = useState({
    confidence: 72,
    patience: 85,
    focus: 78,
    detachment: 65,
    overallScore: 75,
  })

  const metrics = [
    { label: "Confidence", value: discipline.confidence, description: "Belief in your analysis" },
    { label: "Patience", value: discipline.patience, description: "Waiting for confirmation" },
    { label: "Focus", value: discipline.focus, description: "Present moment awareness" },
    { label: "Detachment", value: discipline.detachment, description: "Outcome independence" },
  ]

  return (
    <Card className="glass-card border-border/50 animated-border overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className="size-4 text-cyan-glow" />
          Emotional Discipline Meter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center">
          <div className="relative w-full max-w-[200px]">
            <div className="h-3 rounded-full bg-secondary overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-loss via-yellow-500 to-profit transition-all duration-700"
                style={{ width: `${discipline.overallScore}%` }}
              />
            </div>
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-1 h-5 bg-foreground rounded-full shadow-lg transition-all duration-700"
              style={{ left: `calc(${discipline.overallScore}% - 2px)` }}
            />
          </div>
          <span className="ml-4 text-2xl font-bold text-cyan-glow">{discipline.overallScore}%</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mt-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg bg-secondary/30 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">{metric.label}</span>
                <span className={`text-xs font-medium ${
                  metric.value >= 70 ? "text-profit" : metric.value >= 50 ? "text-yellow-500" : "text-loss"
                }`}>{metric.value}%</span>
              </div>
              <Progress value={metric.value} className="h-1 bg-secondary" />
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-cyan-glow/5 border border-cyan-glow/10 p-3">
          <p className="text-xs text-muted-foreground">
            <span className="text-cyan-glow font-medium">AI Insight:</span> Your patience score is excellent. 
            Work on emotional detachment to improve overall discipline.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// Entry Checklist Component
export function EntryChecklist({ 
  items, 
  onChange,
  onUpdateScore
}: { 
  items: ChecklistItem[]
  onChange: (items: ChecklistItem[]) => void
  onUpdateScore: (score: number) => void
}) {
  const handleCheck = (id: string) => {
    const updated = items.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    )
    onChange(updated)
    
    // Calculate compliance score
    const requiredItems = updated.filter(i => i.required)
    const checkedRequired = requiredItems.filter(i => i.checked).length
    const optionalItems = updated.filter(i => !i.required)
    const checkedOptional = optionalItems.filter(i => i.checked).length
    
    const requiredScore = requiredItems.length > 0 ? (checkedRequired / requiredItems.length) * 80 : 80
    const optionalScore = optionalItems.length > 0 ? (checkedOptional / optionalItems.length) * 20 : 20
    
    onUpdateScore(Math.round(requiredScore + optionalScore))
  }

  const checkedCount = items.filter(i => i.checked).length

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-cyan-glow" />
            Pre-Trade Checklist
          </span>
          <Badge variant="outline" className="text-xs">
            {checkedCount}/{items.length} complete
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 group">
              <Checkbox
                id={`check-${item.id}`}
                checked={item.checked}
                onCheckedChange={() => handleCheck(item.id)}
                className="mt-0.5 border-border data-[state=checked]:bg-profit data-[state=checked]:border-profit"
              />
              <div className="flex-1">
                <label
                  htmlFor={`check-${item.id}`}
                  className={`text-sm cursor-pointer transition-all ${
                    item.checked ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {item.text}
                </label>
                {item.required && (
                  <Badge variant="outline" className="ml-2 text-[10px] border-loss/30 text-loss">
                    Required
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Psychology Rules Component
export function PsychologyRules({ rules }: { rules: string[] }) {
  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className="size-4 text-cyan-glow" />
          Psychology Rules
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rules.map((rule, index) => (
            <div key={index} className="flex items-start gap-3 p-2 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors">
              <div className="size-5 rounded-full bg-cyan-glow/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-medium text-cyan-glow">{index + 1}</span>
              </div>
              <p className="text-sm text-muted-foreground">{rule}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Invalidation Conditions Component
export function InvalidationConditions({ conditions }: { conditions: string[] }) {
  return (
    <Card className="glass-card border-border/50 border-loss/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertOctagon className="size-4 text-loss" />
          Invalidation Conditions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {conditions.map((condition, index) => (
            <div key={index} className="flex items-start gap-3 p-2 rounded-lg bg-loss/5 border border-loss/10">
              <AlertTriangle className="size-4 text-loss shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">{condition}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-loss/10 border border-loss/20">
          <p className="text-xs text-loss font-medium">
            If ANY condition is met, DO NOT enter the trade.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// Risk Management Rules Component
export function RiskManagementRules({ rules }: { rules: RiskRule[] }) {
  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="size-4 text-cyan-glow" />
          Risk Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-lg bg-secondary/30 p-3 border border-border/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{rule.name}</span>
                {rule.enabled && <div className="size-1.5 rounded-full bg-profit" />}
              </div>
              <p className="text-lg font-bold text-cyan-glow">{rule.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Timeframes Component
export function TimeframesDisplay({ timeframes }: { timeframes: string[] }) {
  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="size-4 text-cyan-glow" />
          Timeframes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {timeframes.map((tf, index) => (
            <Badge 
              key={index} 
              variant="outline" 
              className={`${
                index === 0 
                  ? "border-cyan-glow/50 text-cyan-glow bg-cyan-glow/10" 
                  : "border-border/50"
              }`}
            >
              {tf}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Primary: <span className="text-cyan-glow font-medium">{timeframes[0]}</span> • 
          Confirmation: <span className="text-foreground">{timeframes.slice(1).join(", ")}</span>
        </p>
      </CardContent>
    </Card>
  )
}

// Setup Type Tags Component
export function SetupTypeTags({ tags }: { tags: string[] }) {
  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Tag className="size-4 text-cyan-glow" />
          Setup Types
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <Badge 
              key={index} 
              className="bg-secondary/50 text-foreground border border-border/50 hover:border-cyan-glow/30 cursor-default"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Trade Replay Notes Section
export function TradeReplayNotes() {
  const [notes, setNotes] = useState("")
  const [savedNotes, setSavedNotes] = useState([
    {
      id: "1",
      date: "May 26, 2026",
      trade: "EUR/USD Long",
      note: "Entered slightly early before full confirmation. Market structure shift was weak. Should have waited for stronger displacement.",
      outcome: "loss",
      lesson: "Patience is key - wait for full MSS confirmation",
    },
    {
      id: "2",
      date: "May 25, 2026",
      trade: "GBP/JPY Short",
      note: "Perfect execution. Waited for liquidity sweep and MSS. Entry at OB, TP at previous low. Managed emotions well despite price pulling back.",
      outcome: "win",
      lesson: "Trust the process - let the trade play out",
    },
  ])

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Play className="size-4 text-cyan-glow" />
          Trade Replay Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder="Record your trade observations, emotions, and lessons learned..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="bg-secondary/30 border-border/50 focus:border-cyan-glow/50 min-h-[80px] resize-none"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs cursor-pointer hover:bg-profit/10 hover:border-profit/30">
                <TrendingUp className="size-3 mr-1" />
                Win
              </Badge>
              <Badge variant="outline" className="text-xs cursor-pointer hover:bg-loss/10 hover:border-loss/30">
                <AlertTriangle className="size-3 mr-1" />
                Loss
              </Badge>
            </div>
            <Button size="sm" className="bg-cyan-glow/20 text-cyan-glow hover:bg-cyan-glow/30 border border-cyan-glow/30">
              <Save className="size-3 mr-1" />
              Save Note
            </Button>
          </div>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto">
          {savedNotes.map((note) => (
            <div key={note.id} className={`rounded-lg p-3 border ${
              note.outcome === "win" 
                ? "bg-profit/5 border-profit/20" 
                : "bg-loss/5 border-loss/20"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] ${
                      note.outcome === "win" 
                        ? "border-profit/30 text-profit" 
                        : "border-loss/30 text-loss"
                    }`}
                  >
                    {note.trade}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{note.date}</span>
                </div>
                <Button variant="ghost" size="sm" className="size-6 p-0">
                  <Trash2 className="size-3 text-muted-foreground" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{note.note}</p>
              <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                <Star className="size-3 text-cyan-glow" />
                <span className="text-[10px] text-cyan-glow font-medium">Lesson: {note.lesson}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Strategy Editor Component
export function StrategyEditor({ 
  strategy, 
  onSave 
}: { 
  strategy: Strategy | null
  onSave: (strategy: Strategy) => void 
}) {
  const [editedStrategy, setEditedStrategy] = useState<Strategy | null>(strategy)
  const [isEditing, setIsEditing] = useState(false)

  if (!editedStrategy) {
    return (
      <Card className="glass-card border-border/50 h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <div className="size-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Strategy Selected</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Select a strategy from the list or create a new one
          </p>
          <Button className="bg-cyan-glow/20 text-cyan-glow hover:bg-cyan-glow/30 border border-cyan-glow/30">
            <Plus className="size-4 mr-1" />
            Create Strategy
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditing ? (
              <Input
                value={editedStrategy.name}
                onChange={(e) => setEditedStrategy({ ...editedStrategy, name: e.target.value })}
                className="text-lg font-bold bg-secondary/30 border-border/50"
              />
            ) : (
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{editedStrategy.name}</CardTitle>
                {editedStrategy.isAPlus && (
                  <Badge className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/30">
                    <Award className="size-3 mr-1" />
                    A+ Setup
                  </Badge>
                )}
              </div>
            )}
            {isEditing ? (
              <Textarea
                value={editedStrategy.description}
                onChange={(e) => setEditedStrategy({ ...editedStrategy, description: e.target.value })}
                className="mt-2 text-sm bg-secondary/30 border-border/50"
              />
            ) : (
              <p className="text-sm text-muted-foreground mt-1">{editedStrategy.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsEditing(false)}
                  className="border-border/50"
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => {
                    onSave(editedStrategy)
                    setIsEditing(false)
                  }}
                  className="bg-profit/20 text-profit hover:bg-profit/30 border border-profit/30"
                >
                  <Save className="size-3 mr-1" />
                  Save
                </Button>
              </>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsEditing(true)}
                className="border-border/50 hover:border-cyan-glow/30"
              >
                <Edit3 className="size-3 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Win Rate</p>
            <p className="text-xl font-bold text-profit mt-1">{editedStrategy.winRate}%</p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Trades</p>
            <p className="text-xl font-bold text-cyan-glow mt-1">{editedStrategy.tradesUsing}</p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Compliance</p>
            <p className="text-xl font-bold text-foreground mt-1">{editedStrategy.complianceScore}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Main Strategy Builder Component
export function StrategyBuilderMain() {
  const [strategies] = useState<Strategy[]>(mockStrategies)
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(mockStrategies[0]?.id || null)
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(mockStrategies[0]?.entryChecklist || [])
  const [complianceScore, setComplianceScore] = useState(0)

  const selectedStrategy = strategies.find(s => s.id === selectedStrategyId) || null

  const handleStrategySelect = (id: string) => {
    setSelectedStrategyId(id)
    const strategy = strategies.find(s => s.id === id)
    if (strategy) {
      setChecklistItems(strategy.entryChecklist.map(item => ({ ...item, checked: false })))
      setComplianceScore(0)
    }
  }

  const isAPlus = complianceScore >= 90

  return (
    <main className="p-6 space-y-6">
      {/* Top Row - Strategy List + Editor + Compliance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <StrategyList 
            strategies={strategies} 
            selectedId={selectedStrategyId} 
            onSelect={handleStrategySelect}
          />
        </div>
        <div className="lg:col-span-6">
          <StrategyEditor 
            strategy={selectedStrategy} 
            onSave={(s) => console.log("Saved:", s)} 
          />
        </div>
        <div className="lg:col-span-3">
          <StrategyComplianceScore score={complianceScore} isAPlus={isAPlus} />
        </div>
      </div>

      {selectedStrategy && (
        <>
          {/* Second Row - Entry Checklist + Emotional Discipline */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <EntryChecklist 
              items={checklistItems} 
              onChange={setChecklistItems}
              onUpdateScore={setComplianceScore}
            />
            <EmotionalDisciplineMeter />
          </div>

          {/* Third Row - Psychology + Invalidation */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PsychologyRules rules={selectedStrategy.psychologyRules} />
            <InvalidationConditions conditions={selectedStrategy.invalidationConditions} />
          </div>

          {/* Fourth Row - Risk + Timeframes + Tags */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <RiskManagementRules rules={selectedStrategy.riskManagement} />
            <TimeframesDisplay timeframes={selectedStrategy.timeframes} />
            <SetupTypeTags tags={selectedStrategy.setupTypes} />
          </div>

          {/* Fifth Row - Trade Replay Notes */}
          <TradeReplayNotes />
        </>
      )}
    </main>
  )
}
