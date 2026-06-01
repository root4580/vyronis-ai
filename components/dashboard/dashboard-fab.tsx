"use client"

import { Plus } from "lucide-react"

type DashboardFabProps = {
  onClick: () => void
  label?: string
  disabled?: boolean
  disabledReason?: string
}

export function DashboardFab({
  onClick,
  label = "New Trade",
  disabled = false,
  disabledReason,
}: DashboardFabProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? disabledReason ?? "Trading is blocked" : label}
      className="dashboard-fab group disabled:cursor-not-allowed disabled:opacity-45"
      aria-label={label}
    >
      <Plus className="size-5 shrink-0 transition-transform duration-300 group-hover:rotate-90" />
      <span>{label}</span>
    </button>
  )
}
