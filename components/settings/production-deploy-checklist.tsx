"use client"

import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { APP_PRODUCTION_URL } from "@/lib/branding"

const CHECKLIST = [
  {
    title: "Same Supabase project",
    detail: "Vercel env vars must match local .env.local (URL + anon key).",
  },
  {
    title: "SQL migrations",
    detail:
      "Run trade-coach, strategy-brain / War Room, chart-vision, and journal migrations on production.",
  },
  {
    title: "OPENAI_API_KEY",
    detail: "Required on Vercel Production for MTF vision coach and War Room autofill.",
  },
  {
    title: "NEXT_PUBLIC_APP_URL",
    detail: `Set on Production and Preview to ${APP_PRODUCTION_URL} (auth redirects).`,
  },
  {
    title: "Resend SMTP in Supabase",
    detail: "Password reset and verification emails (see docs/SUPABASE-RESEND-SETUP.md).",
  },
] as const

export function ProductionDeployChecklist() {
  return (
    <DashboardInsetPanel className="space-y-3 border-warning/20 bg-warning/[0.04] px-4 py-3">
      <div>
        <p className="text-[12px] font-semibold text-foreground/90">Production parity</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/75">
          Localhost and Vercel only match when deploy, database, and env are aligned.
        </p>
      </div>
      <ul className="space-y-2">
        {CHECKLIST.map((item) => (
          <li key={item.title} className="text-[11px] leading-relaxed text-foreground/85">
            <span className="font-medium text-cyan-glow/90">{item.title}</span>
            <span className="text-muted-foreground/75"> — {item.detail}</span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-muted-foreground/60">
        Full matrix:{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 text-[9px]">docs/VERCEL-LOCAL-PARITY.md</code>
        {" · "}
        <code className="rounded bg-black/30 px-1 py-0.5 text-[9px]">docs/DEPLOY-CHECKLIST.md</code>
      </p>
    </DashboardInsetPanel>
  )
}
