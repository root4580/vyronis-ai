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
    <figure className={cn("group relative", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 rounded-[1.35rem] bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.14),transparent_68%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100"
      />
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.14] bg-[#070b10] shadow-[0_28px_90px_rgba(0,0,0,0.58)] ring-1 ring-cyan-glow/15 transition-transform duration-300 group-hover:-translate-y-0.5">
        <div className="flex items-center gap-2 border-b border-white/[0.08] bg-[linear-gradient(180deg,#0a1017_0%,#060a10_100%)] px-3.5 py-2.5">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="min-w-0 flex-1 rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-1.5">
            <p className="truncate text-[10px] text-muted-foreground/85">{urlPath}</p>
          </div>
          <span className="shrink-0 rounded-full border border-cyan-glow/30 bg-cyan-glow/[0.1] px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/95">
            Product preview
          </span>
        </div>
        <div className="relative overflow-hidden bg-[#0a0f14]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(34,211,238,0.04)_0%,transparent_18%,transparent_82%,rgba(0,0,0,0.22)_100%)]"
          />
          <img
            src={src}
            alt={alt}
            width={1440}
            height={900}
            decoding="async"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            className="relative h-auto w-full"
          />
        </div>
      </div>
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
    <div className="overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0a0f14] shadow-2xl shadow-black/40">
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
