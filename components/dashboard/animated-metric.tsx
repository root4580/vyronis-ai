"use client"

import { useCountUp } from "@/hooks/use-count-up"

type AnimatedMetricProps = {
  value: number
  format?: "currency" | "percent" | "number" | "currency-signed"
  decimals?: number
  className?: string
  animate?: boolean
}

export function AnimatedMetric({
  value,
  format = "number",
  decimals = 0,
  className = "",
  animate = true,
}: AnimatedMetricProps) {
  const animated = useCountUp(value, 900, animate)

  const display = (() => {
    const v = animate ? animated : value
    switch (format) {
      case "currency":
        return `$${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
      case "currency-signed": {
        const sign = value >= 0 ? "+" : "-"
        return `${sign}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
      }
      case "percent":
        return `${Math.round(v)}%`
      default:
        return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    }
  })()

  return <span className={`count-up tabular-nums ${className}`}>{display}</span>
}
