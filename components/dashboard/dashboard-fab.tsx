"use client"

import { Plus } from "lucide-react"

type DashboardFabProps = {
  onClick: () => void
  label?: string
}

export function DashboardFab({ onClick, label = "New Trade" }: DashboardFabProps) {
  return (
    <button type="button" onClick={onClick} className="dashboard-fab group hidden md:flex">
      <Plus className="size-5 transition-transform duration-300 group-hover:rotate-90" />
      <span className="hidden text-[14px] md:inline">{label}</span>
    </button>
  )
}
