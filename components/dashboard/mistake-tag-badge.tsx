"use client"

import {
  getMistakeBadgeClassName,
  type DisplayMistakeTag,
} from "@/lib/mistake-tags"

type MistakeTagListProps = {
  tags: DisplayMistakeTag[]
  limit?: number
  size?: "sm" | "md"
  className?: string
}

export function MistakeTagBadge({ tag, size = "sm" }: { tag: DisplayMistakeTag; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "px-2.5 py-1 text-[11px]" : ""
  return (
    <span className={getMistakeBadgeClassName(tag.dangerous, sizeClass)} title={tag.source === "inferred" ? "Inferred from trade data" : "Tagged mistake"}>
      {tag.label}
    </span>
  )
}

export function MistakeTagList({ tags, limit, size = "sm", className = "" }: MistakeTagListProps) {
  if (tags.length === 0) {
    return (
      <span className={`text-[11px] text-muted-foreground/50 ${className}`}>No mistakes flagged</span>
    )
  }

  const visible = limit ? tags.slice(0, limit) : tags
  const hiddenCount = limit ? Math.max(0, tags.length - limit) : 0

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {visible.map((tag) => (
        <MistakeTagBadge key={tag.id} tag={tag} size={size} />
      ))}
      {hiddenCount > 0 && (
        <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-muted-foreground/70">
          +{hiddenCount}
        </span>
      )}
    </div>
  )
}
