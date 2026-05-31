import type { ReactNode } from "react"
import { Brain, CalendarRange, Target } from "lucide-react"
import { BrowserScreenshotFrame } from "@/components/marketing/browser-screenshot-frame"
import {
  getAiCoachScreenshotFile,
  getBehavioralLeakScreenshotFile,
  getWeeklyDebriefScreenshotFile,
  marketingScreenshotSrc,
} from "@/lib/marketing/screenshots"

function FeatureScreenshot({
  file,
  alt,
  urlPath,
  fallback,
}: {
  file: string | null
  alt: string
  urlPath: string
  fallback: ReactNode
}) {
  if (!file) return <>{fallback}</>
  return (
    <BrowserScreenshotFrame
      src={marketingScreenshotSrc(file)}
      alt={alt}
      urlPath={urlPath}
    />
  )
}

function AiCoachFallback() {
  return (
    <div className="rounded-xl border border-loss/25 bg-black/40 p-5">
      <p className="inline-flex rounded-md border border-loss/30 bg-loss/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-loss">
        Skip · 82%
      </p>
      <p className="mt-3 text-lg font-semibold">Counter-trend entry into H4 supply</p>
      <p className="mt-2 text-[13px] text-muted-foreground">
        HTF aligned but no M15 CHoCH. R:R 1:1.2 below gate. Journal shows revenge pattern.
      </p>
    </div>
  )
}

function DebriefFallback() {
  return (
    <div className="grid grid-cols-5 gap-2">
      {[
        ["D", "Discipline"],
        ["A", "Execution"],
        ["F", "Psychology"],
        ["F", "Risk"],
        ["F", "Overall"],
      ].map(([grade, label]) => (
        <div key={label} className="rounded-lg border border-white/[0.08] bg-black/30 p-3 text-center">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{grade}</p>
        </div>
      ))}
    </div>
  )
}

function LeakFallback() {
  return (
    <div className="rounded-xl border border-cyan-glow/25 bg-cyan-glow/[0.04] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">
        Primary behavioral leak · 73% confidence
      </p>
      <p className="mt-2 text-lg font-semibold">FOMO entries after displacement candles</p>
      <p className="mt-2 text-[13px] text-muted-foreground">
        Wait for M15 confirmation close. Based on your journal only.
      </p>
    </div>
  )
}

const FLAGSHIP_FEATURES = [
  {
    id: "ai-coach",
    icon: Brain,
    eyebrow: "AI Trade Coach",
    title: "Upload a chart. Get a SKIP, CAUTION, or EXECUTE verdict.",
    body: "Vyronis cross-references your chart with journal history — HTF alignment, confirmation quality, R:R gates, and emotional patterns — before you risk capital.",
    bullets: [
      "Chart vision + deep analysis checklist",
      "Verdict reasoning tied to your rules",
      "Journal pattern cross-reference",
    ],
    file: getAiCoachScreenshotFile(),
    alt: "Vyronis AI Trade Coach SKIP verdict with deep analysis",
    urlPath: "vyronishq.com/hq",
    fallback: <AiCoachFallback />,
  },
  {
    id: "weekly-debrief",
    icon: CalendarRange,
    eyebrow: "Weekly AI Debrief",
    title: "A graded report card — not a motivational quote.",
    body: "Every week Vyronis scores Discipline, Execution, Psychology, Risk Management, and Overall performance. Letter grades plus AI commentary on what improved and what declined.",
    bullets: [
      "Discipline / Execution / Psychology / Risk / Overall grades",
      "AI commentary on habits and patterns",
      "Actionable recommendations for next week",
    ],
    file: getWeeklyDebriefScreenshotFile(),
    alt: "Vyronis Weekly AI Debrief scorecard with letter grades",
    urlPath: "vyronishq.com/hq?tab=journal",
    fallback: <DebriefFallback />,
  },
  {
    id: "behavioral-leak",
    icon: Target,
    eyebrow: "Behavioral Leak Detection",
    title: "Your #1 costliest habit — with confidence scoring.",
    body: "Vyronis detects recurring behavioral leaks from journal tags, emotions, and session data. Not signals — the habit that costs you the most.",
    bullets: [
      "Primary leak card with confidence %",
      "Evidence from your last 14 days",
      "Corrective focus for next session",
    ],
    file: getBehavioralLeakScreenshotFile(),
    alt: "Vyronis Primary Behavioral Leak detection at 73 percent confidence",
    urlPath: "vyronishq.com/hq",
    fallback: <LeakFallback />,
  },
] as const

export function FlagshipFeaturesSection() {
  return (
    <section className="border-t border-white/[0.06] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl space-y-20">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-glow/80">
            Flagship intelligence
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            The features that make Vyronis different
          </h2>
          <p className="mt-3 text-muted-foreground">
            Not another journal app. Institutional-grade review, behavioral detection, and AI coaching —
            built from your real trades.
          </p>
        </div>

        {FLAGSHIP_FEATURES.map((feature, index) => {
          const Icon = feature.icon
          const reversed = index % 2 === 1

          return (
            <article
              key={feature.id}
              id={feature.id}
              className={`grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12 ${reversed ? "lg:[&>*:first-child]:order-2" : ""}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-cyan-glow" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-glow/80">
                    {feature.eyebrow}
                  </p>
                </div>
                <h3 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">{feature.title}</h3>
                <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{feature.body}</p>
                <ul className="mt-5 space-y-2">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2 text-[13px] text-foreground/85">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-glow" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>

              <FeatureScreenshot
                file={feature.file}
                alt={feature.alt}
                urlPath={feature.urlPath}
                fallback={feature.fallback}
              />
            </article>
          )
        })}
      </div>
    </section>
  )
}
