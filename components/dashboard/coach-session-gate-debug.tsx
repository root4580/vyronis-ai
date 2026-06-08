"use client"

import type { SessionGateDebug } from "@/lib/coach/session-gate"
import { cn } from "@/lib/utils"

type CoachSessionGateDebugProps = {
  debug: SessionGateDebug
  className?: string
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9.5rem_1fr] gap-2 text-[10px] leading-snug">
      <span className="text-muted-foreground/65">{label}</span>
      <span className="font-medium text-foreground/88">{value}</span>
    </div>
  )
}

export function CoachSessionGateDebug({ debug, className }: CoachSessionGateDebugProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2.5",
        className,
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/80">
        Session gate debug
      </p>
      <div className="mt-2 space-y-1.5">
        <DebugRow label="Current Time" value={debug.currentTimeLabel} />
        <DebugRow label="Current Timezone" value={debug.timezone} />
        <DebugRow label="Detected Session" value={debug.detectedSession} />
        <DebugRow label="Allowed Sessions" value={debug.allowedSessions} />
        <DebugRow
          label="Session Valid Result"
          value={debug.sessionValid ? "✅" : "❌"}
        />
        {debug.loggedSession ? (
          <DebugRow label="Logged Session" value={debug.loggedSession} />
        ) : null}
        {debug.failureReason ? (
          <p className="pt-1 text-[10px] leading-relaxed text-warning-foreground/95">
            {debug.failureReason}
          </p>
        ) : null}
      </div>
    </div>
  )
}
