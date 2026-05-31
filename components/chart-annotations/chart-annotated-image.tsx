"use client"

import type { ChartAnnotation, ChartOverlayMode } from "@/lib/chart-annotations/types"
import { resolveAnnotationStyle } from "@/lib/chart-annotations/theme"
import { cn } from "@/lib/utils"

type ChartAnnotatedImageProps = {
  src: string
  alt: string
  annotations?: ChartAnnotation[]
  mode?: ChartOverlayMode
  className?: string
  imageClassName?: string
  onClick?: () => void
}

function AnnotationShape({ annotation }: { annotation: ChartAnnotation }) {
  const style = resolveAnnotationStyle(annotation.kind, annotation.tone, annotation.dashed)
  const x = annotation.x
  const y = annotation.y
  const width = annotation.width
  const height = annotation.height
  const strokeDasharray = style.dashed ? "2 1.2" : undefined

  return (
    <g key={annotation.id} className="chart-annotation-shape">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={1.2}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={0.35}
        strokeDasharray={strokeDasharray}
        style={{ filter: `drop-shadow(0 0 4px ${style.glow})` }}
      />
      {annotation.arrowTo && (
        <line
          x1={x + width / 2}
          y1={y + height / 2}
          x2={annotation.arrowTo.x}
          y2={annotation.arrowTo.y}
          stroke={style.stroke}
          strokeWidth={0.35}
          markerEnd="url(#chart-arrow)"
        />
      )}
      <foreignObject x={x} y={Math.max(y - 5, 0)} width={Math.min(width + 8, 36)} height={5}>
        <div
          className="truncate rounded px-1 py-0.5 text-[6px] font-semibold uppercase tracking-[0.08em]"
          style={{
            background: style.chipBg,
            color: style.chipText,
            border: `1px solid ${style.stroke}`,
            boxShadow: `0 0 8px ${style.glow}`,
          }}
        >
          {annotation.label}
        </div>
      </foreignObject>
    </g>
  )
}

export function ChartAnnotatedImage({
  src,
  alt,
  annotations = [],
  mode = "raw",
  className,
  imageClassName,
  onClick,
}: ChartAnnotatedImageProps) {
  const showOverlay = mode !== "raw" && annotations.length > 0

  return (
    <div
      className={cn("relative overflow-hidden", onClick && "cursor-pointer", className)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <img src={src} alt={alt} className={cn("block h-full w-full", imageClassName)} />
      {showOverlay && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <marker
              id="chart-arrow"
              markerWidth="4"
              markerHeight="4"
              refX="2"
              refY="2"
              orient="auto"
            >
              <path d="M0,0 L4,2 L0,4 Z" fill="rgb(from var(--color-accent) r g b / 0.9)" />
            </marker>
          </defs>
          {annotations.map((annotation) => (
            <AnnotationShape key={annotation.id} annotation={annotation} />
          ))}
        </svg>
      )}
      {showOverlay && mode === "replay" && (
        <div className="pointer-events-none absolute left-1 top-1 rounded border border-cyan-glow/30 bg-black/55 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-cyan-glow">
          Replay Overlay
        </div>
      )}
    </div>
  )
}
