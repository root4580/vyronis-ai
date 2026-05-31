"use client"

import { Plus } from "lucide-react"

type DashboardFabProps = {
  onClick: () => void
  label?: string
}

export function DashboardFab({ onClick, label = "New Trade" }: DashboardFabProps) {
  return (
    <button type="button" onClick={onClick} className="dashboard-fab group" aria-label={label}>
      <Plus className="size-5 shrink-0 transition-transform duration-300 group-hover:rotate-90" />
      <span>{label}</span>
    </button>
  )
}
