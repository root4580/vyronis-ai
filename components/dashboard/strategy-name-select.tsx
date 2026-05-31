"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TRADE_STRATEGIES } from "@/lib/trade-form-config"

const NEW_STRATEGY_VALUE = "__new_strategy__"

type StrategyNameSelectProps = {
  value: string
  existingNames?: string[]
  onChange: (value: string) => void
  className?: string
  selectContentClassName?: string
  container?: HTMLElement | null
}

export function StrategyNameSelect({
  value,
  existingNames = [],
  onChange,
  className,
  selectContentClassName,
  container,
}: StrategyNameSelectProps) {
  const [creatingNew, setCreatingNew] = useState(false)

  const options = useMemo(() => {
    const fromTrades = existingNames
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
    const merged = [...new Set([...fromTrades, ...TRADE_STRATEGIES])]
    return merged.sort((a, b) => a.localeCompare(b))
  }, [existingNames])

  const selectValue =
    creatingNew || (value && !options.includes(value))
      ? NEW_STRATEGY_VALUE
      : value || undefined

  return (
    <div className="space-y-2">
      <Select
        value={selectValue}
        onValueChange={(next) => {
          if (next === NEW_STRATEGY_VALUE) {
            setCreatingNew(true)
            if (!value || options.includes(value)) onChange("")
            return
          }
          setCreatingNew(false)
          onChange(next)
        }}
      >
        <SelectTrigger className={className ?? "add-trade-input h-10"}>
          <SelectValue placeholder="Select strategy" />
        </SelectTrigger>
        <SelectContent className={selectContentClassName ?? "glass-card border-white/[0.08]"} container={container}>
          {options.map((strategy) => (
            <SelectItem key={strategy} value={strategy}>
              {strategy}
            </SelectItem>
          ))}
          <SelectItem value={NEW_STRATEGY_VALUE}>+ New strategy</SelectItem>
        </SelectContent>
      </Select>

      {creatingNew || selectValue === NEW_STRATEGY_VALUE ? (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type strategy name"
          className="add-trade-input h-10"
        />
      ) : null}
    </div>
  )
}

export function collectStrategyNamesFromTrades(
  trades: Array<{ strategy_name?: string | null }>,
): string[] {
  return trades
    .map((trade) => trade.strategy_name?.trim())
    .filter((name): name is string => Boolean(name && name.length > 0))
}
