"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type CouncilSectionProps = {
  title: string
  id?: string
  description?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}

export function CouncilSection({
  title,
  id,
  description,
  action,
  className,
  children,
}: CouncilSectionProps) {
  return (
    <section id={id} className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--border-subtle)] pb-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-accent">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[11px] text-text-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
