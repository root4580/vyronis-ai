"use client"

import { useCallback, useEffect, useState } from "react"
import { Clock, MessageSquarePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { fetchCommandCenterSessions } from "@/lib/command-center/api-client"
import type { CompanionSessionSummary } from "@/lib/command-center/types"
import { useAIContext } from "@/providers/ai-context-provider"
import { cn } from "@/lib/utils"

function formatSessionDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export function SessionHistoryMenu() {
  const {
    historySessionId,
    openHistorySession,
    startNewSession,
    viewingArchivedSession,
  } = useAIContext()
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<CompanionSessionSummary[]>([])
  const [loading, setLoading] = useState(false)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchCommandCenterSessions()
      setSessions(list)
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void loadSessions()
  }, [open, loadSessions])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Past sessions"
          className={cn(
            "size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-white/[0.06]",
            open && "bg-white/[0.06] text-foreground",
          )}
        >
          <Clock className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="z-[80] w-[min(280px,calc(100vw-2rem))] border-white/[0.1] bg-surface-modal p-2 shadow-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[11px] font-medium text-muted-foreground/70">
            Past sessions
          </p>
          {!viewingArchivedSession ? (
            <button
              type="button"
              onClick={() => {
                void startNewSession()
                setOpen(false)
              }}
              className="inline-flex items-center gap-1 text-[10px] text-cyan-glow/90 hover:text-cyan-glow"
            >
              <MessageSquarePlus className="size-3" />
              New
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="px-2 py-3 text-[11px] text-muted-foreground/60">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-muted-foreground/60">
            Closed sessions appear here after you exit the Command Center.
          </p>
        ) : (
          <ul className="max-h-52 space-y-0.5 overflow-y-auto">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => {
                    void openHistorySession(session.id)
                    setOpen(false)
                  }}
                  className={cn(
                    "w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.05]",
                    historySessionId === session.id && "bg-cyan-glow/[0.08]",
                  )}
                >
                  <p className="truncate text-[11px] font-medium text-foreground/90">
                    {session.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/65">
                    {formatSessionDate(session.updatedAt)} · {session.messageCount} messages
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
