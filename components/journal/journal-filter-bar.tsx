"use client"

import { cn } from "@/lib/utils"
import type { JournalFilters } from "@/lib/journal-utils"

type FilterChipProps = {
  label: string
  active: boolean
  onClick: () => void
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[var(--radius-sm)] border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] text-text-accent"
          : "border-[var(--border-subtle)] bg-white/[0.03] text-text-muted hover:text-text-secondary",
      )}
    >
      {label}
    </button>
  )
}

type JournalFilterBarProps = {
  filters: JournalFilters
  options: {
    pairs: string[]
    sessions: string[]
    results: string[]
    directions: string[]
  }
  tradeCount: number
  filteredCount: number
  onChange: (next: JournalFilters) => void
}

export function JournalFilterBar({
  filters,
  options,
  tradeCount,
  filteredCount,
  onChange,
}: JournalFilterBarProps) {
  const set = (patch: Partial<JournalFilters>) => onChange({ ...filters, ...patch })

  const cycle = <T extends string>(current: T, values: T[], all: T): T => {
    if (current === all) return values[0] ?? all
    const idx = values.indexOf(current)
    if (idx === -1 || idx === values.length - 1) return all
    return values[idx + 1]
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 border-r border-[var(--border-subtle)] pr-2 text-[11px] text-text-muted">
          {filteredCount} of {tradeCount}
        </span>

        <FilterChip
          label={filters.pair === "all" ? "Pair" : filters.pair}
          active={filters.pair !== "all"}
          onClick={() => set({ pair: cycle(filters.pair, options.pairs, "all") })}
        />

        <FilterChip
          label={
            filters.session === "all"
              ? "Session"
              : filters.session.replace(" Session", "").slice(0, 12)
          }
          active={filters.session !== "all"}
          onClick={() => set({ session: cycle(filters.session, options.sessions, "all") })}
        />

        <FilterChip
          label={filters.direction === "all" ? "Direction" : filters.direction}
          active={filters.direction !== "all"}
          onClick={() => set({ direction: cycle(filters.direction, options.directions, "all") })}
        />

        <FilterChip
          label={filters.result === "all" ? "Result" : filters.result}
          active={filters.result !== "all"}
          onClick={() => set({ result: cycle(filters.result, options.results, "all") })}
        />

        <FilterChip
          label={
            filters.hasPlan === "linked"
              ? "Has plan"
              : filters.hasPlan === "unlinked"
                ? "No plan"
                : "Plan link"
          }
          active={filters.hasPlan !== "all"}
          onClick={() =>
            set({
              hasPlan:
                filters.hasPlan === "all"
                  ? "linked"
                  : filters.hasPlan === "linked"
                    ? "unlinked"
                    : "all",
            })
          }
        />

        {(filters.pair !== "all" ||
          filters.session !== "all" ||
          filters.direction !== "all" ||
          filters.result !== "all" ||
          filters.hasPlan !== "all") && (
          <button
            type="button"
            onClick={() =>
              onChange({
                search: filters.search,
                pair: "all",
                session: "all",
                direction: "all",
                result: "all",
                hasPlan: "all",
              })
            }
            className="text-[11px] text-text-accent hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
