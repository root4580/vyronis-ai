"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronUp, History } from "lucide-react"
import { fetchCouncilHistory } from "@/lib/council/api-client"
import type { CouncilHistorySession } from "@/lib/council/types"
import { cn } from "@/lib/utils"

type CouncilHistoryPanelProps = {
  accountId: string | null
  className?: string
}

function formatSessionDate(value: string): string {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

export function CouncilHistoryPanel({ accountId, className }: CouncilHistoryPanelProps) {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<CouncilHistorySession[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!open || loaded || !accountId) return
    void fetchCouncilHistory(accountId)
      .then((payload) => {
        setSessions(payload.sessions.filter((session) => session.messageCount > 0))
      })
      .catch(() => setSessions([]))
      .finally(() => setLoaded(true))
  }, [accountId, loaded, open])

  const pastSessions = sessions.filter(
    (session) => session.sessionDate !== new Date().toISOString().slice(0, 10),
  )

  if (!accountId) return null

  return (
    <section className={cn("rounded-[var(--radius-md)] border border-white/[0.06] bg-white/[0.02]", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-[11px] font-medium text-text-secondary">
          <History className="size-3.5 text-text-muted" />
          Past council sessions
        </span>
        {open ? <ChevronUp className="size-3.5 text-text-muted" /> : <ChevronDown className="size-3.5 text-text-muted" />}
      </button>
      {open ? (
        <div className="space-y-2 border-t border-white/[0.06] px-4 py-3">
          {!loaded ? (
            <p className="text-[11px] text-text-muted">Loading history…</p>
          ) : pastSessions.length === 0 ? (
            <p className="text-[11px] text-text-muted">No past sessions yet — your first briefing will appear here tomorrow.</p>
          ) : (
            pastSessions.map((session) => (
              <div
                key={session.id}
                className="rounded-[var(--radius-sm)] border border-white/[0.06] bg-black/20 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-medium text-text-primary">
                    {formatSessionDate(session.sessionDate)}
                  </p>
                  <span className="text-[10px] text-text-muted">
                    {session.messageCount} messages
                  </span>
                </div>
                {session.keyInsights[0] ? (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-secondary">
                    {session.keyInsights[0]}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  )
}
