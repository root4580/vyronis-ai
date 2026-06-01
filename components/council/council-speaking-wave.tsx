"use client"

import { cn } from "@/lib/utils"

type CouncilSpeakingWaveProps = {
  className?: string
  bars?: number
}

export function CouncilSpeakingWave({ className, bars = 5 }: CouncilSpeakingWaveProps) {
  return (
    <div className={cn("council-speaking-wave flex items-end gap-0.5", className)} aria-hidden>
      {Array.from({ length: bars }).map((_, index) => (
        <span
          key={index}
          className="council-speaking-wave-bar w-0.5 rounded-full bg-cyan-glow/80"
          style={{ animationDelay: `${index * 0.12}s` }}
        />
      ))}
    </div>
  )
}
