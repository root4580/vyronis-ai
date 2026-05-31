import type { Metadata } from "next"
import Link from "next/link"
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Minus,
} from "lucide-react"
import { TeamNotifyForm } from "@/components/marketing/team-notify-form"
import { Button } from "@/components/ui/button"
import {
  APP_NAME,
  BETA_ACCESS_LABEL,
  LAUNCH_PRICE_NOTE,
} from "@/lib/branding"

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Vyronis pricing — free during closed beta. Pro plans from $29/mo after launch. Team plans coming soon.",
}

const PLANS = [
  {
    id: "beta",
    name: "Beta Free",
    badge: BETA_ACCESS_LABEL,
    price: "Free",
    priceDetail: "Full platform access today",
    highlight: true,
    cta: { label: "Join closed beta", href: "/auth/sign-up", variant: "primary" as const },
  },
  {
    id: "pro",
    name: "Pro",
    badge: "After public launch",
    price: "$29",
    priceSuffix: "/mo",
    priceDetail: "Beta users get early pricing",
    highlight: false,
    cta: {
      label: "Get early access pricing",
      href: "/auth/sign-up",
      variant: "outline" as const,
    },
  },
  {
    id: "team",
    name: "Team",
    badge: "Coming soon",
    price: "—",
    priceDetail: "Multi-seat desks & shared analytics",
    highlight: false,
    cta: { label: "Notify me", href: "#", variant: "ghost" as const },
  },
] as const

const COMPARISON_ROWS = [
  { feature: "Trade journal + Vyronis scoring", beta: true, pro: true, team: true },
  { feature: "War Room weekly planning", beta: true, pro: true, team: true },
  { feature: "Analytics + AI weekly review", beta: true, pro: true, team: true },
  { feature: "AI Trade Coach (chart verdicts)", beta: true, pro: true, team: true },
  { feature: "Precision Flow setup scoring", beta: true, pro: true, team: true },
  { feature: "Behavioral leak detection", beta: true, pro: true, team: true },
  { feature: "Pattern memory across entries", beta: true, pro: true, team: true },
  { feature: "MT5 import & TradingView alerts", beta: false, pro: true, team: true },
  { feature: "Evolution OS & replay simulator — coming soon", beta: false, pro: true, team: true },
  { feature: "Priority support", beta: false, pro: true, team: true },
  { feature: "Multi-seat team workspace", beta: false, pro: false, team: true },
  { feature: "Shared desk analytics", beta: false, pro: false, team: true },
] as const

function FeatureCell({ included }: { included: boolean }) {
  if (included) {
    return <Check className="mx-auto size-4 text-profit" aria-label="Included" />
  }
  return <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="Not included" />
}

export default function PricingPage() {
  return (
    <div className="marketing-page min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg border border-cyan-glow/30 bg-cyan-glow/[0.1]">
              <Activity className="size-4 text-cyan-glow" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">{APP_NAME}</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-glow/80">
                Trading OS
              </p>
            </div>
          </Link>
          <nav className="hidden items-center gap-6 text-[13px] text-muted-foreground md:flex">
            <Link href="/#ai-coach" className="hover:text-foreground">
              AI Coach
            </Link>
            <Link href="/#product-preview" className="hover:text-foreground">
              Product
            </Link>
            <Link href="/pricing" className="text-foreground">
              Pricing
            </Link>
            <Link href="/blog" className="hover:text-foreground">
              Insights
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="bg-cyan-glow text-background hover:bg-cyan-glow/90">
              <Link href="/auth/sign-up">
                Start free beta
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-glow/80">
              Pricing
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Clear expectations. No surprises.
            </h1>
            <p className="mt-3 text-muted-foreground">{LAUNCH_PRICE_NOTE}</p>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`flex flex-col rounded-2xl border p-6 ${
                  plan.highlight
                    ? "border-cyan-glow/30 bg-cyan-glow/[0.06]"
                    : plan.id === "team"
                      ? "border-white/[0.06] bg-white/[0.01] opacity-90"
                      : "border-white/[0.08] bg-white/[0.02]"
                }`}
              >
                <p
                  className={`text-[11px] font-semibold uppercase tracking-wider ${
                    plan.highlight ? "text-cyan-glow" : "text-muted-foreground"
                  }`}
                >
                  {plan.badge}
                </p>
                <h2 className="mt-2 text-xl font-bold">{plan.name}</h2>
                <p className="mt-2 text-4xl font-bold">
                  {plan.price}
                  {"priceSuffix" in plan && plan.priceSuffix ? (
                    <span className="text-lg font-medium text-muted-foreground">
                      {plan.priceSuffix}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{plan.priceDetail}</p>

                {plan.id === "beta" ? (
                  <ul className="mt-4 space-y-2 text-[13px] text-foreground/85">
                    {[
                      "Journal + Vyronis scoring",
                      "War Room planning",
                      "Analytics + AI review",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <CheckCircle2 className="size-3.5 text-profit" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : plan.id === "pro" ? (
                  <ul className="mt-4 space-y-2 text-[13px] text-muted-foreground">
                    <li>· Everything in beta, plus priority support</li>
                    <li>· MT5 import &amp; TradingView alerts</li>
                    <li className="text-muted-foreground/60">
                      · Evolution OS &amp; replay simulator — coming soon
                    </li>
                  </ul>
                ) : (
                  <ul className="mt-4 space-y-2 text-[13px] text-muted-foreground">
                    <li>· Everything in Pro</li>
                    <li>· Multi-seat team workspace</li>
                    <li>· Shared desk analytics</li>
                  </ul>
                )}

                {plan.id === "team" ? (
                  <TeamNotifyForm />
                ) : plan.cta.variant === "primary" ? (
                  <Button asChild className="mt-6 w-full bg-cyan-glow text-background">
                    <Link href={plan.cta.href}>
                      {plan.cta.label}
                      <ArrowRight className="ml-1.5 size-3.5" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="mt-6 w-full border-white/[0.12]">
                    <Link href={plan.cta.href}>
                      {plan.cta.label}
                      <ArrowRight className="ml-1.5 size-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-16">
            <h2 className="text-center text-xl font-bold sm:text-2xl">Feature comparison</h2>
            <p className="mx-auto mt-2 max-w-lg text-center text-[13px] text-muted-foreground">
              Full Vyronis stack during beta. Pro and Team tiers expand import, evolution tools, and
              desk workflows after launch.
            </p>

            <div className="mt-8 overflow-x-auto rounded-2xl border border-white/[0.08]">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                    <th className="px-4 py-3 font-semibold sm:px-6">Feature</th>
                    <th className="px-4 py-3 text-center font-semibold sm:px-6">Beta Free</th>
                    <th className="px-4 py-3 text-center font-semibold sm:px-6">Pro</th>
                    <th className="px-4 py-3 text-center font-semibold sm:px-6">Team</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, index) => (
                    <tr
                      key={row.feature}
                      className={index % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]"}
                    >
                      <td className="px-4 py-3 text-foreground/90 sm:px-6">{row.feature}</td>
                      <td className="px-4 py-3 sm:px-6">
                        <FeatureCell included={row.beta} />
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        <FeatureCell included={row.pro} />
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        <FeatureCell included={row.team} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-cyan-glow/20 bg-gradient-to-br from-cyan-glow/[0.08] to-transparent p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold sm:text-3xl">Start with the full platform — free</h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Join closed beta today. No credit card required. Lock in early Pro pricing before
              public launch.
            </p>
            <Button asChild size="lg" className="mt-6 h-12 bg-cyan-glow text-background">
              <Link href="/auth/sign-up">
                Create free account
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-[12px] text-muted-foreground/70">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-[12px] text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <Link href="/blog" className="hover:text-foreground">
              Journal
            </Link>
            <Link href="/auth/sign-up" className="hover:text-foreground">
              Start free beta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
