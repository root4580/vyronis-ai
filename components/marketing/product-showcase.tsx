import type { ReactNode } from "react"
import { BarChart3, BookOpen, Swords } from "lucide-react"
import { BrowserScreenshotFrame } from "@/components/marketing/browser-screenshot-frame"
import {
  getAnalyticsScreenshotFile,
  getHeroScreenshotFile,
  getJournalScreenshotFile,
  getWarRoomScreenshotFile,
  marketingScreenshotSrc,
} from "@/lib/marketing/screenshots"

const SCREENSHOT_URLS = {
  journal: "vyronishq.com/hq?tab=journal",
  warRoom: "vyronishq.com/war-room",
  analytics: "vyronishq.com/analytics",
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

function JournalPreview() {
  return (
    <ScreenshotFrame
      file={getJournalScreenshotFile()}
      alt="Vyronis journal Plan mode with A+ setup scoring"
      urlPath={SCREENSHOT_URLS.journal}
      priority
      fallback={<JournalPreviewMock />}
    />
  )
}

function WarRoomPreview() {
  return (
    <ScreenshotFrame
      file={getWarRoomScreenshotFile()}
      alt="Vyronis War Room weekly planning dashboard"
      urlPath={SCREENSHOT_URLS.warRoom}
      fallback={<WarRoomPreviewMock />}
    />
  )
}

function AnalyticsPreview() {
  return (
    <ScreenshotFrame
      file={getAnalyticsScreenshotFile()}
      alt="Vyronis analytics and discipline metrics"
      urlPath={SCREENSHOT_URLS.analytics}
      fallback={<AnalyticsPreviewMock />}
    />
  )
}

export function ProductShowcase() {
  const heroFile = getHeroScreenshotFile()

  return (
    <div id="product-preview" className="relative">
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.12),transparent_70%)]" />
      <div className="relative space-y-3">
        {heroFile ? (
          <ScreenshotFrame
            file={heroFile}
            alt="Vyronis HQ command center dashboard"
            urlPath={SCREENSHOT_URLS.journal}
            priority
            fallback={<JournalPreview />}
          />
        ) : (
          <JournalPreview />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <WarRoomPreview />
          <AnalyticsPreview />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-1 text-[10px] text-muted-foreground/70">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="size-3 text-cyan-glow/80" />
            Journal scoring
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Swords className="size-3 text-cyan-glow/80" />
            War Room
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BarChart3 className="size-3 text-cyan-glow/80" />
            Analytics
          </span>
        </div>
      </div>
    </div>
  )
}

export function ProductScreenshotsSection() {
  const previews = [
    {
      title: "Journal · Plan mode",
      caption: "Score every setup with Vyronis Core Model fields before you click.",
      file: getJournalScreenshotFile(),
      alt: "Vyronis journal Plan mode",
      mock: <JournalPreviewMock />,
    },
    {
      title: "War Room · Weekly plan",
      caption: "Sunday bias, watchlist, and AOI pair cards in one workflow.",
      file: getWarRoomScreenshotFile(),
      alt: "Vyronis War Room",
      mock: <WarRoomPreviewMock />,
    },
    {
      title: "Analytics · Discipline OS",
      caption: "Win rate, A+ setup rate, and leak detection — not vanity metrics.",
      file: getAnalyticsScreenshotFile(),
      alt: "Vyronis analytics dashboard",
      mock: <AnalyticsPreviewMock />,
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
          Journal scoring, War Room planning, and discipline analytics — captured from the live product
          interface.
        </p>
        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          {previews.map(({ title, caption, file, alt, mock }) => (
            <article key={title} className="space-y-3">
              <ScreenshotFrame
                file={file}
                alt={alt}
                fallback={mock}
                urlPath={
                  title.includes("Journal")
                    ? SCREENSHOT_URLS.journal
                    : title.includes("War Room")
                      ? SCREENSHOT_URLS.warRoom
                      : SCREENSHOT_URLS.analytics
                }
              />
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
