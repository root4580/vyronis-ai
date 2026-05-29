import type { HeatmapDay } from "@/lib/performance-heatmap"
import { getJournalDayTone, type JournalDayTone } from "@/lib/journal/calendar-analytics"
import { cn } from "@/lib/utils"

export function journalDayCellClass(
  day: HeatmapDay,
  options?: { selected?: boolean },
): string {
  const tone = getJournalDayTone(day)
  const selected = options?.selected ?? false

  return cn(
    "group relative flex min-h-[4.5rem] flex-col rounded-xl border p-2 text-left transition-all duration-200 sm:min-h-[5.5rem]",
    day.isPadding && "pointer-events-none invisible border-transparent",
    !day.isPadding &&
      day.inMonth &&
      "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow/50",
    tone === "empty" &&
      "border-white/[0.06] bg-zinc-900/70 text-muted-foreground/55 hover:bg-zinc-800/80",
    tone === "neutral" &&
      "border-white/[0.1] bg-zinc-800/90 text-foreground/80",
    tone === "win" &&
      "border-emerald-500/30 bg-emerald-950/75 text-emerald-50 hover:border-emerald-400/45",
    tone === "loss" &&
      "border-rose-500/30 bg-rose-950/75 text-rose-50 hover:border-rose-400/45",
    day.isToday && !selected && "ring-1 ring-cyan-glow/50 ring-offset-1 ring-offset-background",
    selected && "ring-2 ring-cyan-glow ring-offset-2 ring-offset-background shadow-[0_0_24px_rgba(34,211,238,0.2)]",
  )
}

export function journalDayPnlClass(tone: JournalDayTone): string {
  if (tone === "win") return "text-emerald-300"
  if (tone === "loss") return "text-rose-300"
  return "text-muted-foreground/70"
}
