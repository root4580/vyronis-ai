"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

type CollapsibleDashboardSectionProps = {
  id?: string
  title: string
  subtitle?: string
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  collapseOnMobile?: boolean
  children: React.ReactNode
  className?: string
}

export function CollapsibleDashboardSection({
  id,
  title,
  subtitle,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  collapseOnMobile = true,
  children,
  className,
}: CollapsibleDashboardSectionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : uncontrolledOpen

  function setOpen(next: boolean) {
    if (isControlled) onOpenChange?.(next)
    else setUncontrolledOpen(next)
  }

  return (
    <section id={id} className={cn("dashboard-section", className)}>
      <button
        type="button"
        onClick={() => collapseOnMobile && setOpen(!open)}
        className={cn(
          "flex w-full items-center justify-between gap-2 text-left",
          collapseOnMobile && "lg:pointer-events-none",
        )}
        aria-expanded={open}
      >
        <div>
          <p className="dashboard-section-title mb-0">{title}</p>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground/65">{subtitle}</p>
          ) : null}
        </div>
        {collapseOnMobile ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] lg:hidden">
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </span>
        ) : null}
      </button>
      <div
        className={cn(
          "mt-3",
          collapseOnMobile && !open && "hidden lg:block",
          collapseOnMobile && open && "block",
        )}
      >
        {children}
      </div>
    </section>
  )
}
