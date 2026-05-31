import Link from "next/link"
import {
  Activity,
  ArrowRight,
  Brain,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Crosshair,
  Shield,
  Sparkles,
  Target,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  APP_HOME_PATH,
  APP_NAME,
  BETA_ACCESS_LABEL,
  LAUNCH_PRICE_NOTE,
  MARKETING_DESCRIPTION,
  PRECISION_FLOW_TAGLINE,
} from "@/lib/branding"
import { ProductScreenshotsSection, ProductShowcase } from "@/components/marketing/product-showcase"
import { FlagshipFeaturesSection } from "@/components/marketing/flagship-features-section"
import { BlogTeaserSection } from "@/components/marketing/blog-teaser-section"
import { TestimonialsSection } from "@/components/marketing/testimonials-section"
import { getCanonicalSiteUrl } from "@/lib/site-url"

const FEATURES = [
  {
    icon: Brain,
    title: "AI Trade Coach",
    body: "Upload a chart — get SKIP, CAUTION, or EXECUTE with deep HTF, confirmation, R:R, and journal cross-reference.",
  },
  {
    icon: Crosshair,
    title: "Weekly War Room",
    body: "Sunday bias, watchlist, and AOI pair cards. Plan the week before the market opens.",
  },
  {
    icon: Target,
    title: "Behavioral Leak Detection",
    body: "Your #1 costliest habit surfaced with confidence scoring and corrective focus from journal data.",
  },
  {
    icon: CalendarRange,
    title: "Weekly AI Debrief",
    body: "Graded report card: Discipline, Execution, Psychology, Risk, and Overall — plus AI commentary.",
  },
  {
    icon: Sparkles,
    title: "Pattern Memory",
    body: "Recurring mistakes, session leaks, and winning conditions remembered across every journal entry.",
  },
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
    q: "How much does Vyronis cost?",
    a: "Vyronis is free during closed beta. Pro plans from $29/mo after public launch. No credit card required to join beta.",
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
          <a href="#ai-coach" className="hover:text-foreground">
            AI Coach
          </a>
          <a href="#product-preview" className="hover:text-foreground">
            Product
          </a>
          <a href="#precision-flow" className="hover:text-foreground">
            Precision Flow
          </a>
          <a href="#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <Link href="/blog" className="hover:text-foreground">
            Insights
          </Link>
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
              Start free beta
              <ArrowRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

export function LandingPage() {
  const siteUrl = getCanonicalSiteUrl()

  return (
    <div className="marketing-page min-h-[100dvh] bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: APP_NAME,
            url: siteUrl,
            applicationCategory: "FinanceApplication",
            description: MARKETING_DESCRIPTION,
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
              description: BETA_ACCESS_LABEL,
            },
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
                {BETA_ACCESS_LABEL} · No card required
              </p>
              <h1 className="text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
                Upload a chart. Get a verdict.{" "}
                <span className="bg-gradient-to-r from-cyan-glow to-profit bg-clip-text text-transparent">
                  Trade with discipline.
                </span>
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Vyronis AI Coach gives SKIP / EXECUTE verdicts with deep analysis. Weekly debrief grades,
                behavioral leak detection, and journal scoring — one trading OS.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  asChild
                  size="lg"
                  className="h-12 bg-gradient-to-r from-cyan-glow to-profit font-semibold text-background"
                >
                  <Link href="/auth/sign-up">
                    Create free account
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 border-white/[0.12]">
                  <a href="#product-preview">See how it works</a>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/70">
                {LAUNCH_PRICE_NOTE} · Already have access?{" "}
                <Link href="/auth/login" className="text-cyan-glow/90 hover:underline">
                  Sign in to {APP_HOME_PATH}
                </Link>
              </p>
            </div>
            <ProductShowcase />
          </div>
          <div className="mx-auto mt-12 flex max-w-6xl justify-center">
            <a href="#precision-flow" className="flex flex-col items-center gap-1 text-muted-foreground/50">
              <span className="text-[10px] uppercase tracking-widest">Explore</span>
              <ChevronDown className="size-4 animate-bounce" />
            </a>
          </div>
        </section>

        <ProductScreenshotsSection />

        <FlagshipFeaturesSection />

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
            <p className="mt-3 max-w-2xl text-muted-foreground">
              The full Vyronis stack — not just a journal. Coach, War Room, debrief, leak detection, and scoring.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <TestimonialsSection />

        <BlogTeaserSection />

        {/* Pricing */}
        <section id="pricing" className="border-t border-white/[0.06] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-4xl">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-glow/80">
              Pricing
            </p>
            <h2 className="mt-2 text-center text-2xl font-bold sm:text-3xl">
              Clear expectations. No surprises.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
              {LAUNCH_PRICE_NOTE}
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-cyan-glow/30 bg-cyan-glow/[0.06] p-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-glow">
                  Closed beta
                </p>
                <p className="mt-2 text-4xl font-bold">Free</p>
                <p className="mt-1 text-sm text-muted-foreground">Full platform access today</p>
                <ul className="mt-4 space-y-2 text-[13px] text-foreground/85">
                  {["Journal + Vyronis scoring", "War Room planning", "Analytics + AI review"].map(
                    (item) => (
                      <li key={item} className="flex items-center gap-2">
                        <CheckCircle2 className="size-3.5 text-profit" />
                        {item}
                      </li>
                    ),
                  )}
                </ul>
                <Button asChild className="mt-6 w-full bg-cyan-glow text-background">
                  <Link href="/auth/sign-up">Join closed beta</Link>
                </Button>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  After launch
                </p>
                <p className="mt-2 text-4xl font-bold">
                  From <span className="text-cyan-glow">$29</span>
                  <span className="text-lg font-medium text-muted-foreground">/mo</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Pro tier · beta users get early pricing</p>
                <ul className="mt-4 space-y-2 text-[13px] text-muted-foreground">
                  <li>· Everything in beta, plus priority support</li>
                  <li>· MT5 import &amp; TradingView alerts</li>
                  <li>· Evolution OS &amp; replay simulator</li>
                </ul>
                <Button asChild variant="outline" className="mt-6 w-full border-white/[0.12]">
                  <a href="#product-preview">See how it works</a>
                </Button>
              </div>
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
            <h2 className="text-2xl font-bold sm:text-3xl">Ready to trade with discipline?</h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Create your command center — free during closed beta, no credit card required.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 bg-cyan-glow text-background">
                <Link href="/auth/sign-up">Create free account</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="h-12">
                <Link href="/blog">Read the journal</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-[12px] text-muted-foreground/70">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-[12px] text-muted-foreground">
            <Link href="/blog" className="hover:text-foreground">
              Journal
            </Link>
            <Link href="/auth/login" className="hover:text-foreground">
              Sign in
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
