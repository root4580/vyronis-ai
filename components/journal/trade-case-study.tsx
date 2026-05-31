"use client"

import Link from "next/link"
import {
  Brain,
  GitCompare,
  Layers,
  Lightbulb,
  ListChecks,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import type { TradeCaseStudy, CaseStudySection } from "@/lib/journal/trade-case-study"
import { cn } from "@/lib/utils"

const SECTION_ICONS: Record<string, typeof Layers> = {
  structure: Layers,
  confirmation: ListChecks,
  emotion: Brain,
  setup: Target,
  mistakes: Shield,
  ai: Sparkles,
  similar: GitCompare,
  improve: Lightbulb,
}

function toneClass(tone: CaseStudySection["tone"]) {
  if (tone === "positive") return "border-profit/20 bg-profit/[0.04]"
  if (tone === "warning") return "border-warning/25 bg-warning/[0.05]"
  if (tone === "insight") return "border-cyan-glow/20 bg-cyan-glow/[0.04]"
  return "border-white/[0.08] bg-white/[0.02]"
}

type Props = {
  study: TradeCaseStudy
  onSync?: () => void
  syncing?: boolean
  tradeId: string
}

export function TradeCaseStudyView({ study, onSync, syncing, tradeId }: Props) {
  const showSyncPrompt = study.needsIntelligenceSync && onSync

  return (
    <div className="space-y-3">
      <DashboardInsetPanel className="border-warning/15 bg-warning/[0.04] px-3 py-2.5">
        <p className="text-[11px] leading-relaxed text-amber-100/90">{study.discretionaryNote}</p>
      </DashboardInsetPanel>

      {showSyncPrompt ? (
        <DashboardInsetPanel className="border-cyan-glow/25 bg-cyan-glow/[0.06] px-3 py-3">
          <p className="text-[12px] font-medium text-foreground/95">Unlock full case study</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">
            Sync runs AI setup scoring, coaching notes, and fingerprint matching
            {study.historyTradeCount < 5
              ? ` (${study.historyTradeCount} trade${study.historyTradeCount === 1 ? "" : "s"} logged — patterns get stronger after ~5).`
              : "."}
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-3 h-9 w-full bg-cyan-glow/90 text-[11px] font-semibold text-background hover:bg-cyan-glow"
            disabled={syncing}
            onClick={onSync}
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync memory"}
          </Button>
        </DashboardInsetPanel>
      ) : onSync ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2">
          <p className="text-[10px] text-muted-foreground/75">
            Re-sync after edits to refresh fingerprints and AI notes.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-[10px]"
            disabled={syncing}
            onClick={onSync}
          >
            <RefreshCw className={cn("mr-1 size-3", syncing && "animate-spin")} />
            Sync memory
          </Button>
        </div>
      ) : null}

      <nav className="flex gap-1 overflow-x-auto pb-1">
        {study.sections.map((s) => (
          <a
            key={s.id}
            href={`#case-${s.id}`}
            className="shrink-0 rounded-md border border-white/[0.06] px-2 py-1 text-[9px] text-muted-foreground hover:text-cyan-glow"
          >
            {s.title.split(" ")[0]}
          </a>
        ))}
      </nav>

      {study.sections.map((section) => {
        const Icon = SECTION_ICONS[section.id] ?? Layers
        return (
          <section
            key={section.id}
            id={`case-${section.id}`}
            className={cn("rounded-xl border px-3 py-3 sm:px-4", toneClass(section.tone))}
          >
            <div className="flex items-start gap-2">
              <Icon className="mt-0.5 size-4 shrink-0 text-cyan-glow/80" />
              <div className="min-w-0 flex-1">
                <h2 className="text-[13px] font-semibold tracking-tight">{section.title}</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground/75">{section.summary}</p>
                <ul className="mt-2 space-y-1.5">
                  {section.bullets.map((bullet, bulletIndex) => (
                    <li
                      key={`${section.id}-bullet-${bulletIndex}`}
                      className="text-[12px] leading-relaxed text-foreground/88 before:mr-1.5 before:text-cyan-glow/50 before:content-['•']"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {section.id === "similar" && study.fingerprint.losses.length > 0 ? (
              <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-2">
                <p className="text-[9px] font-medium uppercase tracking-wide text-loss/80">
                  Loss fingerprints
                </p>
                {study.fingerprint.losses.slice(0, 3).map((m) => (
                  <Link
                    key={m.tradeId}
                    href={`/journal/trade/${m.tradeId}`}
                    className="flex items-center justify-between rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5 text-[10px] hover:border-cyan-glow/20"
                  >
                    <span className="line-clamp-1">{m.narrative}</span>
                    <span className="shrink-0 tabular-nums text-cyan-glow">{m.similarity}%</span>
                  </Link>
                ))}
              </div>
            ) : null}

            {section.id === "similar" && study.fingerprint.wins.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                <p className="text-[9px] font-medium uppercase tracking-wide text-profit/80">
                  Win fingerprints
                </p>
                {study.fingerprint.wins.slice(0, 2).map((m) => (
                  <div
                    key={m.tradeId}
                    className="flex items-center gap-1 rounded-md border border-profit/15 bg-profit/[0.03] px-2 py-1.5 text-[10px]"
                  >
                    <TrendingUp className="size-3 shrink-0 text-profit" />
                    <span className="line-clamp-1">{m.narrative}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {section.id === "similar" && study.fingerprint.losses.length === 0 && study.fingerprint.wins.length === 0 ? (
              <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <TrendingDown className="size-3" />
                Log more trades to build comparable fingerprints.
              </p>
            ) : null}
          </section>
        )
      })}

      {study.memoryLine ? (
        <DashboardInsetPanel className="border-violet-500/20 bg-violet-500/[0.06] px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-violet-100/90">{study.memoryLine}</p>
        </DashboardInsetPanel>
      ) : null}

      <p className="text-center text-[10px] text-muted-foreground/50">
        Case study · trade {tradeId.slice(0, 8)}…
      </p>
    </div>
  )
}
