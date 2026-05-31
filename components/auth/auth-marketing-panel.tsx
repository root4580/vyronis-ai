"use client"

import Link from "next/link"
import { ArrowRight, Brain, CheckCircle2, Target } from "lucide-react"
import { APP_NAME, MARKETING_DESCRIPTION, PRECISION_FLOW_TAGLINE } from "@/lib/branding"

export function AuthMarketingPanel() {
  return (
    <div className="hidden lg:flex lg:w-[min(420px,40vw)] lg:flex-col lg:justify-center lg:border-r lg:border-white/[0.06] lg:bg-white/[0.02] lg:px-10 lg:py-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-glow/80">
        {APP_NAME}
      </p>
      <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight">
        The AI-assisted trading operating system
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{MARKETING_DESCRIPTION}</p>
      <ul className="mt-8 space-y-3">
        {[
          { icon: Target, text: "Precision Flow — score setups before you enter" },
          { icon: Brain, text: "Vyronis AI grades every journal entry A+ to Skip" },
          { icon: CheckCircle2, text: "Plan setup · Log result · Review like a desk" },
        ].map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-2.5 text-[13px] text-foreground/85">
            <Icon className="mt-0.5 size-4 shrink-0 text-cyan-glow" />
            {text}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[11px] text-muted-foreground/65">{PRECISION_FLOW_TAGLINE}</p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-1 text-[12px] font-medium text-cyan-glow hover:text-cyan-glow/80"
      >
        Learn more about Vyronis
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  )
}
