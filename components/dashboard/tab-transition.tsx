"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import type { DashboardTab } from "@/components/dashboard/trading-components"

const TAB_ORDER: DashboardTab[] = ["dashboard", "strategies", "analytics", "journal"]

type TabTransitionProps = {
  activeTab: DashboardTab
  children: ReactNode
}

export function TabTransition({ activeTab, children }: TabTransitionProps) {
  const prevTabRef = useRef(activeTab)
  const [direction, setDirection] = useState<"left" | "right">("right")

  useEffect(() => {
    const prevIdx = TAB_ORDER.indexOf(prevTabRef.current)
    const nextIdx = TAB_ORDER.indexOf(activeTab)
    setDirection(nextIdx >= prevIdx ? "right" : "left")
    prevTabRef.current = activeTab
  }, [activeTab])

  return (
    <div key={activeTab} className={`dashboard-tab-transition dashboard-tab-slide-${direction}`}>
      {children}
    </div>
  )
}
