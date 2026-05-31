import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type BrowserScreenshotFrameProps = {
  src: string
  alt: string
  urlPath?: string
  priority?: boolean
  className?: string
}

export function BrowserScreenshotFrame({
  src,
  alt,
  urlPath = "vyronishq.com/hq",
  priority,
  className,
}: BrowserScreenshotFrameProps) {
  return (
    <figure className={cn("group", className)}>
      <div className="overflow-hidden rounded-xl border border-white/[0.12] bg-[#0a0f14] shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-cyan-glow/10">
        <div className="flex items-center gap-2 border-b border-white/[0.08] bg-[#060a10] px-3 py-2.5">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="min-w-0 flex-1 rounded-md border border-white/[0.06] bg-white/[0.04] px-3 py-1">
            <p className="truncate text-[10px] text-muted-foreground/80">{urlPath}</p>
          </div>
          <span className="shrink-0 rounded-full border border-cyan-glow/25 bg-cyan-glow/[0.08] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-cyan-glow/90">
            Live UI
          </span>
        </div>
        {/* Native img — Next.js Image optimizer rejects SVG (400 on Vercel). */}
        <img
          src={src}
          alt={alt}
          width={1440}
          height={900}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          className="h-auto w-full"
        />
      </div>
      <figcaption className="mt-2 text-center text-[10px] text-muted-foreground/60">
        Actual Vyronis HQ interface
      </figcaption>
    </figure>
  )
}

export function BrowserMockFrame({
  urlPath = "vyronishq.com/hq",
  children,
}: {
  urlPath?: string
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.12] bg-[#0a0f14] shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2 border-b border-white/[0.08] bg-[#060a10] px-3 py-2">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-[#ff5f57]/90" />
          <span className="size-2 rounded-full bg-[#febc2e]/90" />
          <span className="size-2 rounded-full bg-[#28c840]/90" />
        </div>
        <div className="min-w-0 flex-1 rounded-md bg-white/[0.04] px-2 py-0.5">
          <p className="truncate text-[9px] text-muted-foreground/70">{urlPath}</p>
        </div>
      </div>
      {children}
    </div>
  )
}
