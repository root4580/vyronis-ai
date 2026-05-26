"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface PremiumDatePickerProps {
  value: string
  onChange: (date: string) => void
  className?: string
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

export function PremiumDatePicker({ value, onChange, className }: PremiumDatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [viewDate, setViewDate] = React.useState(() => {
    if (value) {
      const [year, month] = value.split("-").map(Number)
      return new Date(year, month - 1, 1)
    }
    return new Date()
  })
  const [isAnimating, setIsAnimating] = React.useState(false)
  const [slideDirection, setSlideDirection] = React.useState<"left" | "right" | null>(null)

  const selectedDate = React.useMemo(() => {
    if (!value) return null
    const [year, month, day] = value.split("-").map(Number)
    return new Date(year, month - 1, day)
  }, [value])

  const today = React.useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

  const daysInMonth = React.useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysCount = lastDay.getDate()
    const startingDay = firstDay.getDay()
    
    const days: (Date | null)[] = []
    
    // Previous month's trailing days
    for (let i = 0; i < startingDay; i++) {
      const prevDate = new Date(year, month, -startingDay + i + 1)
      days.push(prevDate)
    }
    
    // Current month's days
    for (let i = 1; i <= daysCount; i++) {
      days.push(new Date(year, month, i))
    }
    
    // Next month's leading days
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i))
    }
    
    return days
  }, [viewDate])

  const handlePrevMonth = () => {
    setSlideDirection("right")
    setIsAnimating(true)
    setTimeout(() => {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
      setIsAnimating(false)
    }, 150)
  }

  const handleNextMonth = () => {
    setSlideDirection("left")
    setIsAnimating(true)
    setTimeout(() => {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
      setIsAnimating(false)
    }, 150)
  }

  const handleSelectDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    onChange(`${year}-${month}-${day}`)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent, date: Date) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleSelectDate(date)
    }
  }

  const isToday = (date: Date) => {
    return date.getTime() === today.getTime()
  }

  const isSelected = (date: Date) => {
    if (!selectedDate) return false
    return date.getTime() === selectedDate.getTime()
  }

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === viewDate.getMonth()
  }

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "Select date"
    const [year, month, day] = dateStr.split("-").map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border px-3 py-2 text-sm",
            "bg-secondary/30 border-border/50 hover:bg-secondary/50",
            "focus:outline-none focus:ring-2 focus:ring-cyan-glow/20 focus:border-cyan-glow/50",
            "transition-all duration-200 group",
            className
          )}
        >
          <span className={cn(
            "transition-colors",
            value ? "text-foreground" : "text-muted-foreground"
          )}>
            {formatDisplayDate(value)}
          </span>
          <CalendarIcon className="size-4 text-muted-foreground group-hover:text-cyan-glow transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn(
          "w-[320px] p-0 overflow-hidden",
          "bg-card/95 backdrop-blur-xl border-border/50",
          "shadow-[0_0_40px_rgba(0,200,200,0.1)]",
          "rounded-xl"
        )}
        align="start"
        sideOffset={8}
      >
        {/* Header with month navigation */}
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <button
            type="button"
            onClick={handlePrevMonth}
            className={cn(
              "p-2 rounded-lg",
              "bg-secondary/30 hover:bg-secondary/60",
              "border border-border/30 hover:border-cyan-glow/30",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-cyan-glow/30",
              "group"
            )}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4 text-muted-foreground group-hover:text-cyan-glow transition-colors" />
          </button>
          
          <div className={cn(
            "text-sm font-semibold tracking-wide",
            "transition-all duration-150",
            isAnimating && slideDirection === "left" && "opacity-0 translate-x-4",
            isAnimating && slideDirection === "right" && "opacity-0 -translate-x-4"
          )}>
            <span className="text-cyan-glow">{MONTHS[viewDate.getMonth()]}</span>
            <span className="text-muted-foreground ml-2">{viewDate.getFullYear()}</span>
          </div>
          
          <button
            type="button"
            onClick={handleNextMonth}
            className={cn(
              "p-2 rounded-lg",
              "bg-secondary/30 hover:bg-secondary/60",
              "border border-border/30 hover:border-cyan-glow/30",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-cyan-glow/30",
              "group"
            )}
            aria-label="Next month"
          >
            <ChevronRight className="size-4 text-muted-foreground group-hover:text-cyan-glow transition-colors" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-0 px-3 pt-3">
          {DAYS.map((day) => (
            <div
              key={day}
              className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div 
          className={cn(
            "grid grid-cols-7 gap-0 p-3 transition-all duration-150",
            isAnimating && slideDirection === "left" && "opacity-0 translate-x-8",
            isAnimating && slideDirection === "right" && "opacity-0 -translate-x-8"
          )}
        >
          {daysInMonth.map((date, index) => {
            if (!date) return <div key={index} className="aspect-square" />
            
            const current = isCurrentMonth(date)
            const selected = isSelected(date)
            const todayDate = isToday(date)
            
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectDate(date)}
                onKeyDown={(e) => handleKeyDown(e, date)}
                tabIndex={current ? 0 : -1}
                className={cn(
                  "relative aspect-square flex items-center justify-center",
                  "text-sm font-medium rounded-lg m-0.5",
                  "transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-cyan-glow/40",
                  
                  // Base state
                  !current && "text-muted-foreground/40",
                  current && !selected && !todayDate && "text-foreground hover:bg-secondary/60 hover:text-cyan-glow",
                  
                  // Today state
                  todayDate && !selected && [
                    "text-cyan-glow",
                    "ring-2 ring-cyan-glow/40",
                    "hover:bg-cyan-glow/10"
                  ],
                  
                  // Selected state
                  selected && [
                    "bg-gradient-to-br from-cyan-glow/90 to-cyan-glow/70",
                    "text-background font-semibold",
                    "shadow-[0_0_20px_rgba(0,200,200,0.4)]",
                    "scale-105"
                  ]
                )}
                aria-selected={selected}
                aria-current={todayDate ? "date" : undefined}
              >
                {date.getDate()}
                
                {/* Glow effect for selected */}
                {selected && (
                  <span className="absolute inset-0 rounded-lg bg-cyan-glow/20 blur-sm -z-10" />
                )}
                
                {/* Dot indicator for today */}
                {todayDate && !selected && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-cyan-glow" />
                )}
              </button>
            )
          })}
        </div>

        {/* Footer with today button */}
        <div className="p-3 border-t border-border/30">
          <button
            type="button"
            onClick={() => {
              const now = new Date()
              setViewDate(new Date(now.getFullYear(), now.getMonth(), 1))
              handleSelectDate(now)
            }}
            className={cn(
              "w-full py-2 rounded-lg text-xs font-medium uppercase tracking-wider",
              "bg-secondary/30 hover:bg-cyan-glow/10",
              "border border-border/30 hover:border-cyan-glow/30",
              "text-muted-foreground hover:text-cyan-glow",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-cyan-glow/30"
            )}
          >
            Today
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
