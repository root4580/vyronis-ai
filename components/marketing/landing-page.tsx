import Link from "next/link"
import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronDown,
  Shield,
  Sparkles,
  Target,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  APP_HOME_PATH,
  APP_NAME,
  MARKETING_DESCRIPTION,
  PRECISION_FLOW_TAGLINE,
} from "@/lib/branding"

const FEATURES = [
  {
    icon: Target,
    title: "Precision Flow Strategy",
    body: "HTF alignment, AOI, structure confirmation, and R:R gates — scored before you click.",
  },
  {
    icon: Brain,
    title: "Vyronis AI Scoring",
    body: "Every journal entry graded A+ / A / B / Skip with reasons, warnings, and one improvement.",
  },
  {
    icon: BarChart3,
    title: "Discipline Analytics",
    body: "Win rate, leak detection, emotion patterns, and session stats — not vanity metrics.",
  },
  {
    icon: Shield,
    title: "Plan vs Log Split",
    body: "Score setups before entry. Log results fast after the trade. One OS, two workflows.",
  },
]

const FAQ = [
  {
    q: "Is Vyronis a signal service?",
    a: "No. Vyronis is a trading operating system — strategy scoring, journal intelligence, and discipline analytics. You bring the edge; Vyronis enforces process.",
  },
  {
    q: "What is Precision Flow?",
    a: "Our structured setup framework: Weekly/Daily/H4 bias, area of interest, confirmation, entry quality, emotion gate, and minimum 1:2 risk-reward.",
  },
  {
    q: "Does Vyronis work for prop firm traders?",
    a: "Yes. Built for funded and independent traders who need institutional-grade review without institutional overhead.",
  },
  {
    q: "Can I import MT5 trades?",
    a: "Yes. Screenshot autofill and import pipelines connect execution data to Vyronis scoring automatically.",
  },
]

function Nav() {
  return (
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
          <a href="#precision-flow" className="hover:text-foreground">
            Precision Flow
          </a>
          <a href="#journal" className="hover:text-foreground">
            AI Journal
          </a>
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#faq" className="hover:text-foreground">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="bg-cyan-glow text-background hover:bg-cyan-glow/90">
            <Link href="/auth/sign-up">
              Get started
              <ArrowRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

function DemoPreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-cyan-glow/[0.06] via-background to-profit/[0.04] p-4 shadow-[0_0_60px_rgba(34,211,238,0.08)] sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">
            Vyronis Command Center
          </p>
          <p className="text-sm font-medium text-foreground/90">XAUUSD · Plan setup</p>
        </div>
        <span className="rounded-full border border-cyan-glow/35 bg-cyan-glow/[0.12] px-3 py-1 text-xs font-bold text-cyan-glow">
          A+ · 94
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {["HTF aligned", "Liquidity swept", "R:R 1:3"].map((label) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-lg border border-profit/20 bg-profit/[0.06] px-3 py-2 text-[11px] text-foreground/85"
          >
            <CheckCircle2 className="size-3.5 shrink-0 text-profit" />
            {label}
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Grade</p>
          <p className="mt-1 text-2xl font-bold text-cyan-glow">A+</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Recommendation</p>
          <p className="mt-1 text-sm font-semibold text-profit">Execute</p>
        </div>
      </div>
    </div>
  )
}

export function LandingPage() {
  return (
    <div className="marketing-page min-h-[100dvh] bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: APP_NAME,
            applicationCategory: "FinanceApplication",
            description: MARKETING_DESCRIPTION,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          }),
        }}
      />

      <Nav />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.14),transparent_55%)]" />
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
            <div className="relative space-y-6">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-cyan-glow/25 bg-cyan-glow/[0.08] px-3 py-1 text-[11px] font-medium text-cyan-glow">
                <Sparkles className="size-3.5" />
                AI-assisted trading operating system
              </p>
              <h1 className="text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
                Trade with{" "}
                <span className="bg-gradient-to-r from-cyan-glow to-profit bg-clip-text text-transparent">
                  institutional discipline
                </span>
                — powered by Vyronis AI
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {MARKETING_DESCRIPTION}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  asChild
                  size="lg"
                  className="h-12 bg-gradient-to-r from-cyan-glow to-profit font-semibold text-background"
                >
                  <Link href="/auth/sign-up">
                    Start free
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 border-white/[0.12]">
                  <Link href="/auth/login">Sign in to HQ</Link>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/70">
                Premium journal · Vyronis Core Model scoring · War Room · Analytics
              </p>
            </div>
            <DemoPreview />
          </div>
          <div className="mx-auto mt-12 flex max-w-6xl justify-center">
            <a href="#precision-flow" className="flex flex-col items-center gap-1 text-muted-foreground/50">
              <span className="text-[10px] uppercase tracking-widest">Explore</span>
              <ChevronDown className="size-4 animate-bounce" />
            </a>
          </div>
        </section>

        {/* Precision Flow */}
        <section id="precision-flow" className="border-t border-white/[0.06] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-glow/80">
              Precision Flow Strategy
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Every setup scored before you risk capital
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">{PRECISION_FLOW_TAGLINE}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { step: "01", label: "HTF Bias", detail: "Weekly · Daily · H4 aligned" },
                { step: "02", label: "AOI", detail: "Supply, demand, liquidity zones" },
                { step: "03", label: "Confirmation", detail: "CHoCH · BOS · retest" },
                { step: "04", label: "Gate", detail: "Emotion + min 1:2 R:R" },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
                >
                  <p className="text-[10px] font-bold tabular-nums text-cyan-glow/70">{item.step}</p>
                  <p className="mt-1 font-semibold">{item.label}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground/80">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI Journal */}
        <section id="journal" className="border-t border-white/[0.06] bg-white/[0.01] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-glow/80">
                Vyronis Journal Intelligence
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Plan setup. Log result. Review like a desk.
              </h2>
              <ul className="mt-6 space-y-3">
                {[
                  "Plan setup mode — A+ gate + Vyronis score before entry",
                  "Log result mode — fast post-trade capture on mobile",
                  "Auto-grade A+ / A / B / Skip with pass/fail summary",
                  "Main mistake + one improvement on every entry",
                ].map((line) => (
                  <li key={line} className="flex gap-2 text-[13px] text-foreground/85">
                    <Zap className="mt-0.5 size-3.5 shrink-0 text-cyan-glow" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                Sample evaluation
              </p>
              <p className="mt-2 text-sm text-foreground/90">
                Why it passed: HTF pro-trend aligned · CHoCH at AOI · R:R 1:3.2
              </p>
              <p className="mt-2 text-sm text-amber-200/90">
                Warning: Session outside London kill zone
              </p>
              <p className="mt-3 rounded-lg border border-cyan-glow/20 bg-cyan-glow/[0.05] p-3 text-[12px]">
                One improvement: Wait for retest entry — mark Perfect, not Early.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-white/[0.06] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Built for serious traders</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <article
                  key={title}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 transition-colors hover:border-cyan-glow/20"
                >
                  <Icon className="size-5 text-cyan-glow" />
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing placeholder */}
        <section id="pricing" className="border-t border-white/[0.06] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-lg text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-glow/80">
              Pricing
            </p>
            <h2 className="mt-2 text-2xl font-bold">Early access — full platform</h2>
            <p className="mt-3 text-muted-foreground">
              Pricing tiers launching soon. Create an account now for full access during beta.
            </p>
            <div className="mt-8 rounded-2xl border border-cyan-glow/25 bg-cyan-glow/[0.04] p-6">
              <p className="text-3xl font-bold">Beta</p>
              <p className="mt-1 text-sm text-muted-foreground">Journal · Scoring · War Room · Analytics</p>
              <Button asChild className="mt-6 w-full bg-cyan-glow text-background">
                <Link href="/auth/sign-up">Create account</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-white/[0.06] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight">FAQ</h2>
            <div className="mt-8 space-y-4">
              {FAQ.map(({ q, a }) => (
                <details
                  key={q}
                  className="group rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 open:border-cyan-glow/20"
                >
                  <summary className="cursor-pointer list-none font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-2">
                      {q}
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-white/[0.06] px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-2xl border border-cyan-glow/20 bg-gradient-to-br from-cyan-glow/[0.08] to-transparent p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold sm:text-3xl">Open your command center</h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Join traders using Vyronis to plan, score, and review every setup with AI discipline.
            </p>
            <Button asChild size="lg" className="mt-6 h-12 bg-cyan-glow text-background">
              <Link href="/auth/sign-up">Get started — it&apos;s free</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-[12px] text-muted-foreground/70">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <div className="flex gap-4 text-[12px] text-muted-foreground">
            <Link href="/auth/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/auth/sign-up" className="hover:text-foreground">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
