"use client"

import {
  getJournalMistakeBadgeClassName,
  JOURNAL_MISTAKE_CLUSTER_CLASS,
} from "@/lib/journal-badges"
import type { DisplayMistakeTag } from "@/lib/mistake-tags"
import { cn } from "@/lib/utils"

type MistakeTagListProps = {
  tags: DisplayMistakeTag[]
  limit?: number
  size?: "sm" | "md"
  className?: string
  /** Tighter row layout — single line with overflow badge */
  compact?: boolean
}

export function MistakeTagBadge({
  tag,
  size = "sm",
}: {
  tag: DisplayMistakeTag
  size?: "sm" | "md"
}) {
  return (
    <span
      className={cn(
        getJournalMistakeBadgeClassName(tag.label, tag.dangerous, size),
        "max-w-[9.5rem] truncate sm:max-w-[11rem] md:max-w-none",
      )}
      title={tag.source === "inferred" ? "Inferred from trade data" : "Tagged mistake"}
    >
      {tag.label}
    </span>
  )
}

export function MistakeTagList({
  tags,
  limit,
  size = "sm",
  className = "",
  compact = false,
}: MistakeTagListProps) {
  if (tags.length === 0) {
    return (
      <span className={cn("text-[11px] text-muted-foreground/50", className)}>
        No mistakes flagged
      </span>
    )
  }

  const visible = limit ? tags.slice(0, limit) : tags
  const hiddenCount = limit ? Math.max(0, tags.length - limit) : 0

  return (
    <div
      className={cn(
        JOURNAL_MISTAKE_CLUSTER_CLASS,
        compact ? "flex-nowrap overflow-hidden" : "flex-wrap",
        className,
      )}
    >
      {visible.map((tag) => (
        <MistakeTagBadge key={tag.id} tag={tag} size={size} />
      ))}
      {hiddenCount > 0 && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]",
            size === "md"
              ? "h-7 min-h-[28px] px-2.5 text-[11px] font-medium text-muted-foreground/75"
              : "h-6 min-h-[24px] px-2 text-[10px] font-medium text-muted-foreground/75",
          )}
          title={`${hiddenCount} more mistake${hiddenCount > 1 ? "s" : ""}`}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  )
}
