import type { ReactNode } from "react"
import { BarChart3, BookOpen, Swords } from "lucide-react"
import { BrowserScreenshotFrame } from "@/components/marketing/browser-screenshot-frame"
import {
  getAiCoachScreenshotFile,
  getAnalyticsScreenshotFile,
  getBehavioralLeakScreenshotFile,
  getHeroScreenshotFile,
  getJournalScreenshotFile,
  getWarRoomScreenshotFile,
  getWeeklyDebriefScreenshotFile,
  marketingScreenshotSrc,
} from "@/lib/marketing/screenshots"

const SCREENSHOT_URLS = {
  journal: "vyronishq.com/hq?tab=journal",
  warRoom: "vyronishq.com/war-room",
  analytics: "vyronishq.com/analytics",
  aiCoach: "vyronishq.com/hq",
  weeklyDebrief: "vyronishq.com/hq?tab=journal",
  behavioralLeak: "vyronishq.com/hq",
} as const

function ScreenshotFrame({
  file,
  alt,
  fallback,
  priority,
  urlPath,
}: {
  file: string | null
  alt: string
  fallback: ReactNode
  priority?: boolean
  urlPath?: string
}) {
  if (!file) {
    return <>{fallback}</>
  }

  return (
    <BrowserScreenshotFrame
      src={marketingScreenshotSrc(file)}
      alt={alt}
      urlPath={urlPath}
      priority={priority}
    />
  )
}

function PanelChrome({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a0f14] shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-black/40 px-3 py-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/75">
            {title}
          </p>
          <p className="text-[11px] text-muted-foreground/80">{subtitle}</p>
        </div>
        <div className="flex gap-1">
          <span className="size-2 rounded-full bg-white/10" />
          <span className="size-2 rounded-full bg-white/10" />
          <span className="size-2 rounded-full bg-white/10" />
        </div>
      </div>
      {children}
    </div>
  )
}

function JournalPreviewMock() {
  return (
    <PanelChrome title="Vyronis Journal" subtitle="XAUUSD · Plan setup · London">
      <div className="grid gap-2 p-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {["Weekly bullish", "Daily BOS", "H4 retest"].map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-profit/25 bg-profit/[0.08] px-2 py-0.5 text-[9px] text-profit"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">AOI</p>
            <p className="mt-0.5 text-[11px]">London liquidity sweep · demand zone</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-cyan-glow/30 bg-cyan-glow/[0.08] px-4 py-3 text-center">
          <p className="text-[9px] uppercase tracking-wider text-cyan-glow/70">Vyronis grade</p>
          <p className="text-3xl font-bold text-cyan-glow">A+</p>
          <p className="mt-1 text-[10px] font-semibold text-profit">94 · Execute</p>
        </div>
      </div>
    </PanelChrome>
  )
}

function WarRoomPreviewMock() {
  return (
    <PanelChrome title="War Room" subtitle="Week of May 25 · Sunday plan">
      <div className="space-y-2 p-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
          <Swords className="size-3.5 text-cyan-glow" />
          <div>
            <p className="text-[10px] font-medium">Weekly bias · Risk-on USD weakness</p>
            <p className="text-[9px] text-muted-foreground/70">Watchlist: XAUUSD, EURUSD, GBPUSD</p>
          </div>
        </div>
      </div>
    </PanelChrome>
  )
}

function AnalyticsPreviewMock() {
  return (
    <PanelChrome title="Analytics" subtitle="Last 30 trades · Vyronis OS">
      <div className="grid grid-cols-3 gap-2 p-3">
        {[
          { label: "Win rate", value: "58%", tone: "text-foreground" },
          { label: "A+ setups", value: "71%", tone: "text-cyan-glow" },
          { label: "Avg R:R", value: "1:2.4", tone: "text-profit" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-white/[0.06] bg-black/25 p-2 text-center">
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground/55">{stat.label}</p>
            <p className={`mt-1 text-sm font-bold tabular-nums ${stat.tone}`}>{stat.value}</p>
          </div>
        ))}
      </div>
    </PanelChrome>
  )
}

function AiCoachPreview() {
  return (
    <ScreenshotFrame
      file={getAiCoachScreenshotFile() ?? getHeroScreenshotFile()}
      alt="Vyronis AI Trade Coach SKIP verdict with deep chart analysis"
      urlPath={SCREENSHOT_URLS.aiCoach}
      priority
      fallback={<JournalPreviewMock />}
    />
  )
}

function WeeklyDebriefPreview() {
  return (
    <ScreenshotFrame
      file={getWeeklyDebriefScreenshotFile()}
      alt="Vyronis Weekly AI Debrief scorecard"
      urlPath={SCREENSHOT_URLS.weeklyDebrief}
      fallback={<AnalyticsPreviewMock />}
    />
  )
}

function BehavioralLeakPreview() {
  return (
    <ScreenshotFrame
      file={getBehavioralLeakScreenshotFile()}
      alt="Vyronis Primary Behavioral Leak detection"
      urlPath={SCREENSHOT_URLS.behavioralLeak}
      fallback={<WarRoomPreviewMock />}
    />
  )
}

export function ProductShowcase() {
  return (
    <div id="product-preview" className="relative">
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.12),transparent_70%)]" />
      <div className="relative space-y-3">
        <AiCoachPreview />
        <div className="grid gap-3 sm:grid-cols-2">
          <WeeklyDebriefPreview />
          <BehavioralLeakPreview />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-1 text-[10px] text-muted-foreground/70">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="size-3 text-cyan-glow/80" />
            AI Coach verdicts
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Swords className="size-3 text-cyan-glow/80" />
            Weekly debrief grades
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BarChart3 className="size-3 text-cyan-glow/80" />
            Behavioral leak detection
          </span>
        </div>
      </div>
    </div>
  )
}

export function ProductScreenshotsSection() {
  const previews = [
    {
      title: "AI Trade Coach",
      caption: "Upload a chart and get SKIP / CAUTION / EXECUTE with deep analysis and journal cross-reference.",
      file: getAiCoachScreenshotFile(),
      alt: "Vyronis AI Trade Coach",
      mock: <AiCoachPreview />,
      urlPath: SCREENSHOT_URLS.aiCoach,
    },
    {
      title: "Weekly AI Debrief",
      caption: "Graded report card: Discipline, Execution, Psychology, Risk, and Overall — with AI commentary.",
      file: getWeeklyDebriefScreenshotFile(),
      alt: "Vyronis Weekly AI Debrief",
      mock: <WeeklyDebriefPreview />,
      urlPath: SCREENSHOT_URLS.weeklyDebrief,
    },
    {
      title: "Behavioral Leak Detection",
      caption: "Your #1 costliest habit with confidence scoring and corrective focus — from journal data only.",
      file: getBehavioralLeakScreenshotFile(),
      alt: "Vyronis Behavioral Leak Detection",
      mock: <BehavioralLeakPreview />,
      urlPath: SCREENSHOT_URLS.behavioralLeak,
    },
    {
      title: "Journal · Plan mode",
      caption: "Score every setup with Vyronis Core Model fields before you click.",
      file: getJournalScreenshotFile(),
      alt: "Vyronis journal Plan mode",
      mock: <JournalPreviewMock />,
      urlPath: SCREENSHOT_URLS.journal,
    },
    {
      title: "War Room · Weekly plan",
      caption: "Sunday bias, watchlist, and AOI pair cards in one workflow.",
      file: getWarRoomScreenshotFile(),
      alt: "Vyronis War Room",
      mock: <WarRoomPreviewMock />,
      urlPath: SCREENSHOT_URLS.warRoom,
    },
    {
      title: "Analytics · Discipline OS",
      caption: "Win rate, equity curve, and honest performance metrics.",
      file: getAnalyticsScreenshotFile(),
      alt: "Vyronis analytics dashboard",
      mock: <AnalyticsPreviewMock />,
      urlPath: SCREENSHOT_URLS.analytics,
    },
  ]

  return (
    <section className="border-t border-white/[0.06] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-glow/80">
          Product preview
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Real Vyronis HQ — not a mockup
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          AI Coach verdicts, weekly debrief grades, behavioral leak detection, and journal scoring —
          captured from the live Vyronis HQ interface.
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {previews.map(({ title, caption, file, alt, mock, urlPath }) => (
            <article key={title} className="space-y-3">
              <ScreenshotFrame file={file} alt={alt} fallback={mock} urlPath={urlPath} />
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">{caption}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
