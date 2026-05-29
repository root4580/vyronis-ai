"use client"

import { AlertTriangle } from "lucide-react"
import { WAR_ROOM_MIGRATION_FILES } from "@/lib/strategy-brain/migration-hint"

export function StrategyBrainSetupBanner({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-4 py-4">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" />
        <div className="min-w-0 space-y-2">
          <p className="text-[13px] font-medium text-amber-100">Database setup required</p>
          <p className="text-[12px] leading-relaxed text-amber-100/85">
            War Room and Strategy Brain need tables in the{" "}
            <strong className="font-medium">same Supabase project</strong> your Vercel deployment uses
            (<code className="text-[11px]">NEXT_PUBLIC_SUPABASE_URL</code>).
          </p>
          <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-foreground/80">
            <li>
              Open Supabase → <span className="text-foreground/90">SQL Editor</span>
            </li>
            <li>
              New query: copy the <strong>entire</strong> file{" "}
              <code className="rounded bg-black/40 px-1 py-0.5 text-[10px] text-cyan-glow/90">
                supabase/RUN-STRATEGY-BRAIN-AND-WAR-ROOM.sql
              </code>{" "}
              from line 1 through the end (not only the bottom ALTER TABLE block)
            </li>
            <li>Wait for success, then refresh this page</li>
          </ol>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 text-[11px] font-medium text-cyan-glow hover:underline"
            >
              I ran the migration — retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
